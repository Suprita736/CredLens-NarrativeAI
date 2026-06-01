// src/background/index.ts — CredLens NarrativeAI Phase 1
//
// Narrative Verification Pipeline.
//
// Decision flow:
//   Transcript
//   → Transcript stabilization (content script)
//   → Narrative representation (semantic embedding)
//   → Semantic cache check (cosine similarity)
//   → If cache hit → reuse verdict + evidence → done
//   → Narrative-driven retrieval (PubMed, FactCheck, News)
//   → Local verdict builder (evidence-driven templates)
//   → If confidence < 40 AND LLM key configured → Gemini/OpenRouter fallback
//   → Cache result + respond
//
// Normal operation works WITHOUT any API keys.
// Gemini and OpenRouter are NOT primary components.

import { QueueManager } from './queueManager';
import { CacheService } from '../services/cacheService';
import { RetrievalEngine } from '../services/retrievalEngine';
import { buildNarrative, hasVerifiableContent } from '../utils/narrativeEngine';
import { buildVerdict, buildNoClaimsVerdict } from '../utils/verdictBuilder';
import type { NarrativeAnalysis, BackgroundMessage, BackgroundResponse } from '../types';

// ── Lifecycle hooks ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Background] CredLens NarrativeAI installed/updated.');
  CacheService.prune();
});

chrome.runtime.onStartup.addListener(() => {
  CacheService.prune();
});

chrome.runtime.onSuspend.addListener(() => {
  QueueManager.cancelAll();
});

// ── Port message router ────────────────────────────────────────────────────────

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'credlens-verification') return;
  console.log('[Background] Content script connected.');

  let activeVideoId: string | null = null;

  port.onMessage.addListener(async (message: BackgroundMessage) => {
    const { action, videoId, transcript } = message;
    if (action === 'VERIFY_TRANSCRIPT' && videoId && transcript) {
      activeVideoId = videoId;
      await runNarrativePipeline(videoId, transcript, port);
    } else if (action === 'CANCEL_VERIFICATION' && videoId) {
      console.log(`[Background] Cancel requested for ${videoId}`);
      QueueManager.cancel(videoId);
    }
  });

  port.onDisconnect.addListener(() => {
    console.log('[Background] Port disconnected.');
    if (activeVideoId) QueueManager.cancel(activeVideoId);
  });
});

// ── Narrative Verification Pipeline ────────────────────────────────────────────

async function runNarrativePipeline(
  videoId: string,
  transcript: string,
  port: chrome.runtime.Port
): Promise<void> {
  postResponse(port, { status: 'loading', videoId });
  const signal = QueueManager.register(videoId);

  try {
    // ── Step 1: Load API keys (all optional) ────────────────────────────────
    const storage = await chrome.storage.local.get([
      'geminiApiKey',
      'openRouterApiKey',
    ]) as { geminiApiKey?: string; openRouterApiKey?: string };

    const geminiApiKey = storage.geminiApiKey || '';
    const openRouterApiKey = storage.openRouterApiKey || '';
    const googleApiKey = geminiApiKey; // Same key for Fact Check API

    console.log(
      `[Background] Keys: gemini=${geminiApiKey ? '✓' : '✗'}, openRouter=${openRouterApiKey ? '✓' : '✗'}`
    );

    // ── Step 2: Video ID cache check ────────────────────────────────────────
    const cachedByVideo = await CacheService.getByVideoId(videoId);
    if (cachedByVideo) {
      console.log(`[Background] Cache Hit (videoId): ${videoId}`);
      postResponse(port, { status: 'completed', videoId, analysis: cachedByVideo });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 3: Verifiable content check ────────────────────────────────────
    if (!hasVerifiableContent(transcript)) {
      console.log('[Background] No verifiable content detected in transcript.');
      const noClaimsResult = buildNoClaimsVerdict(
        'No verifiable claims detected in this video.'
      );
      await CacheService.set(videoId, [], noClaimsResult, {});
      postResponse(port, { status: 'completed', videoId, analysis: noClaimsResult });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 4: Build narrative representation ──────────────────────────────
    console.log('[Background] Building narrative representation...');
    const narrative = await buildNarrative(transcript);
    console.log(
      `[Background] Narrative built: ${narrative.themes.length} themes, ` +
      `query="${narrative.retrievalQuery.slice(0, 80)}…"`
    );

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 5: Semantic cache check ────────────────────────────────────────
    const semanticMatch = await CacheService.findSimilarNarrative(narrative.embedding);
    if (semanticMatch) {
      console.log('[Background] Semantic cache hit! Reusing previous analysis.');
      await CacheService.set(videoId, narrative.embedding, semanticMatch, {});
      postResponse(port, { status: 'completed', videoId, analysis: semanticMatch });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 6: Narrative-driven retrieval ───────────────────────────────────
    console.log('[Background] ==> Narrative retrieval START');
    const evidence = await RetrievalEngine.retrieve(
      narrative.retrievalQuery,
      googleApiKey,
      signal
    );

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 7: Local verdict builder ───────────────────────────────────────
    console.log('[Background] Building local verdict from evidence...');
    let analysis: NarrativeAnalysis = buildVerdict(evidence, narrative.retrievalQuery);
    console.log(
      `[Background] Local verdict: "${analysis.verdict}", confidence=${analysis.confidence}`
    );

    // ── Step 8: LLM fallback (only if confidence < 40 AND key available) ──
    if (analysis.confidence < 40) {
      // Try Gemini (optional)
      if (geminiApiKey && !signal.aborted) {
        try {
          console.log('[Background] Low confidence — attempting Gemini fallback...');
          const { GeminiService } = await import('../services/geminiService');
          const gemini = new GeminiService(geminiApiKey);
          const geminiResult = await gemini.synthesizeNarrative(
            narrative.retrievalQuery,
            evidence,
            signal
          );
          analysis = geminiResult;
          console.log('[Background] Gemini synthesis succeeded.');
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
          console.warn('[Background] Gemini fallback failed (non-fatal):', err?.message);
        }
      }

      // Try OpenRouter (optional, last resort)
      if (analysis.confidence < 40 && openRouterApiKey && !signal.aborted) {
        try {
          console.log('[Background] Low confidence — attempting OpenRouter fallback...');
          const { OpenRouterProvider } = await import('../services/openRouterService');
          const openRouter = new OpenRouterProvider(openRouterApiKey);
          const orResult = await openRouter.analyzeNarrative(
            narrative.retrievalQuery,
            evidence
          );
          if (orResult.confidence && orResult.confidence > analysis.confidence) {
            analysis = orResult;
            console.log('[Background] OpenRouter result used.');
          }
        } catch (err: any) {
          if (err?.name === 'AbortError') throw err;
          console.warn('[Background] OpenRouter fallback failed (non-fatal):', err?.message);
        }
      }
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 9: Cache and respond ───────────────────────────────────────────
    await CacheService.set(videoId, narrative.embedding, analysis, evidence);
    postResponse(port, { status: 'completed', videoId, analysis });

  } catch (error: any) {
    if (error?.name === 'AbortError' || signal.aborted) {
      console.log(`[Background] Pipeline aborted for ${videoId}`);
    } else {
      console.error(`[Background] Pipeline error for ${videoId}:`, error);
      postResponse(port, {
        status: 'error',
        videoId,
        error: `Verification failed: ${error?.message || String(error)}`,
      });
    }
  } finally {
    QueueManager.complete(videoId);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function postResponse(
  port: chrome.runtime.Port,
  response: BackgroundResponse
): void {
  try {
    port.postMessage(response);
  } catch {
    // Port may have disconnected; swallow silently
  }
}
