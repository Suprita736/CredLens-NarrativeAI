// src/background/index.ts — CredLens Narrative Synthesis Architecture
//
// Pipeline:
//   Watch Completion Gate (content script)
//   ↓
//   Full Stabilized Transcript
//   ↓
//   Haiku Narrative Synthesis (Claude 3.5 Haiku via OpenRouter)
//   ↓
//   Domain Routing
//   ↓
//   Evidence Retrieval (PubMed, FactCheck, News)
//   ↓
//   Confidence Scoring (4-axis)
//   ↓
//   Verdict (Supported / Exaggerated / Misleading / Insufficient Evidence)
//   ↓
//   Video Cache
//
// NOTE: Gemini is kept as a deprecated fallback but NOT called during normal operation.

import { QueueManager } from './queueManager';
import { CacheService } from '../services/cacheService';
import { RetrievalEngine } from '../services/retrievalEngine';
import { synthesizeNarrative } from '../services/narrativeSynthesisService';
import { generateRetrievalQueries } from '../services/queryGenerationService';
import { isClaimWorthy } from '../utils/claimWorthinessGate';
import { buildVerdict, buildNoClaimsVerdict } from '../utils/verdictBuilder';
import { evaluateEvidence } from '../services/evidenceEvaluationService';
import { syncInsufficientEvidence } from '../services/supabaseSync';
import { supabaseConfig } from '../config/supabase';
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
    const { action, videoId, transcript, transcriptLength = 0, currentProgress = 0, videoTitle = 'Unknown Title', channelName = 'Unknown Channel' } = message;
    if (action === 'VERIFY_TRANSCRIPT' && videoId && transcript) {
      activeVideoId = videoId;
      await runNarrativePipeline(videoId, videoTitle, channelName, transcript, transcriptLength, currentProgress, port);
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

// ── Narrative Synthesis Pipeline ───────────────────────────────────────────────

async function runNarrativePipeline(
  videoId: string,
  videoTitle: string,
  channelName: string,
  transcript: string,
  transcriptLength: number,
  currentProgress: number,
  port: chrome.runtime.Port
): Promise<void> {
  postResponse(port, { status: 'loading', videoId });
  const signal = QueueManager.register(videoId);

  try {
    // ── Step 1: Load API keys ─────────────────────────────────────────────────
    const storage = await chrome.storage.local.get([
      'geminiApiKey',
      'openRouterApiKey'
    ]) as { geminiApiKey?: string; openRouterApiKey?: string };

    const openRouterApiKey = storage.openRouterApiKey || '';
    const googleApiKey = storage.geminiApiKey || ''; // Used for Fact Check API

    console.log(
      `[Background] Keys: openRouter=${openRouterApiKey ? '✓' : '✗'}, google=${googleApiKey ? '✓' : '✗'}`
    );

    // ── Step 2: Video ID cache check ──────────────────────────────────────────
    const cachedByVideo = await CacheService.getByVideoId(videoId);
    if (cachedByVideo) {
      console.log(`[Background] Cache Hit (videoId): ${videoId}`);
      postResponse(port, { status: 'completed', videoId, analysis: cachedByVideo });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 3: Watch Gate Check ──────────────────────────────────────────────
    const watchPercentage = Math.round(currentProgress * 100);
    if (watchPercentage < 85) {
      console.log(`[WatchGate] Verification blocked (<85%)`);
      return;
    }
    console.log(`[WatchGate] Verification triggered at ${watchPercentage}%`);

    // ── Step 4: OpenRouter API key required check ─────────────────────────────
    if (!openRouterApiKey) {
      console.warn('[Background] OpenRouter API key required for Narrative Synthesis.');
      const noKeyResult = buildNoClaimsVerdict(
        'OpenRouter API key is required for narrative analysis. Please configure it in the extension settings.'
      );
      postResponse(port, { status: 'completed', videoId, analysis: noKeyResult });
      QueueManager.complete(videoId);
      return;
    }

    // ── Step 5: Transcript minimum check ──────────────────────────────────────
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    if (wordCount < 15) {
      console.log('[Background] Transcript too short for synthesis.');
      const shortResult = buildNoClaimsVerdict('Transcript too short to analyze.');
      await CacheService.set(videoId, transcriptLength, currentProgress, shortResult, {});
      postResponse(port, { status: 'completed', videoId, analysis: shortResult });
      QueueManager.complete(videoId);
      return;
    }

    if (!isClaimWorthy(transcript)) {
      const skippedResult = buildNoClaimsVerdict('Content skipped by Claim Worthiness Gate (not factual or verifiable).');
      await CacheService.set(videoId, transcriptLength, currentProgress, skippedResult, {});
      postResponse(port, { status: 'completed', videoId, analysis: skippedResult });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 6: Haiku Narrative Synthesis ──────────────────────────────────────
    console.log('[Background] ===> Haiku Narrative Synthesis START');
    const synthesis = await synthesizeNarrative(transcript, openRouterApiKey, signal);
    console.log('[Background] ===> Haiku Narrative Synthesis COMPLETE');
    console.log(`[Background] Central claim: "${synthesis.central_claim}"`);
    console.log(`[Background] Domain: ${synthesis.claim_domain}`);

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 7: Build retrieval queries from synthesis ─────────────────────────
    console.log('[Background] ===> Pass 1.5 Query Generation START');
    const generated = await generateRetrievalQueries(synthesis, openRouterApiKey, signal);
    
    let maxQueries = 6;
    const d = synthesis.claim_domain.toLowerCase();
    if (d.includes('politics') || d.includes('current_events')) {
      maxQueries = 8;
    }

    const retrievalQueries = [
      ...generated.pubmedQueries,
      ...generated.factCheckQueries,
      ...generated.newsQueries
    ].filter(Boolean).slice(0, maxQueries);

    if (retrievalQueries.length === 0) {
      retrievalQueries.push(synthesis.central_claim);
    }
    console.log('[Background] ===> Pass 1.5 Query Generation COMPLETE', retrievalQueries);

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 8: Domain-routed evidence retrieval ──────────────────────────────
    console.log('[Background] ===> Evidence Retrieval START');
    const evidence = await RetrievalEngine.retrieve(
      retrievalQueries,
      synthesis.claim_domain,
      googleApiKey,
      signal
    );
    console.log('[Background] ===> Evidence Retrieval COMPLETE');

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 9: Pass 2 — Evidence Evaluation (Haiku interprets evidence) ────
    console.log('[Background] ===> Pass 2 Evidence Evaluation START');
    const evaluation = await evaluateEvidence(
      synthesis,
      evidence.healthResearch ?? [],
      evidence.newsArticles ?? [],
      openRouterApiKey,
      signal
    );
    console.log('[Background] ===> Pass 2 Evidence Evaluation COMPLETE');
    if (evaluation) {
      console.log(`[Background] Evidence verdict: ${evaluation.overall_verdict}, confidence: ${evaluation.overall_confidence}`);
    }

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // ── Step 10: 4-axis confidence scoring + verdict ──────────────────────────
    console.log('[Background] ===> Confidence Scoring + Verdict');
    const analysis: NarrativeAnalysis = buildVerdict(evidence, synthesis, retrievalQueries.length, evaluation);
    analysis.retrievalQueries = retrievalQueries;
    console.log(
      `[Background] Verdict: "${analysis.verdict}", Confidence: ${analysis.confidence}/100`
    );

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    // --- TASK 3 ASYNC SUPABASE SYNC ---
    const STORABLE_VERDICTS = ["Insufficient Evidence", "Exaggerated", "Misleading"];
    
    if (
      STORABLE_VERDICTS.includes(analysis.verdict) &&
      analysis.confidence >= 40
    ) {
      try {
        const archiveId = await syncInsufficientEvidence(
          videoId,
          videoTitle,
          channelName,
          transcript,
          analysis,
          synthesis,
          evidence,
          evaluation,
          supabaseConfig.url,
          supabaseConfig.anonKey
        );
        if (archiveId) {
          analysis.archiveId = archiveId;
        }
      } catch (err) {
        console.error('[SupabaseSync] Uncaught error:', err);
      }
    } else {
      console.log('[SupabaseSync] Upload skipped');
    }
    // ---------------------------------------

    // ── Step 11: Cache and respond ────────────────────────────────────────────
    await CacheService.set(videoId, transcriptLength, currentProgress, analysis, evidence, synthesis);
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
