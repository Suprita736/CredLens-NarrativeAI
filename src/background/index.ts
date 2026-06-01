// src/background/index.ts
// CredLens Phase 5 — Retrieval-First, LLM-Last-Resort Pipeline

import { QueueManager } from "./queueManager";
import { CacheService } from "../services/cacheService";
import { ConfidenceScorer } from "../utils/confidenceScorer";
import { filterForClaims } from "../utils/claimFilter";
import { extractClaimSentences } from "../utils/claimExtractor";
import { filterVerifiableClaim } from "../utils/verifiabilityFilter";
import { ClaimClassifier } from "../utils/claimClassifier";
import { RetrievalEngine } from "../services/retrievalEngine";
import { EscalationManager } from "../utils/escalationManager";
import type { ClaimAnalysis, BackgroundMessage, BackgroundResponse } from "../types";

// ── Lifecycle hooks ────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  console.log("[Background] CredLens AI installed/updated.");
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
  if (port.name !== "credlens-verification") return;
  console.log("[Background] Content script connected.");

  let activeVideoId: string | null = null;

  port.onMessage.addListener(async (message: BackgroundMessage) => {
    const { action, videoId, transcript } = message;
    if (action === "VERIFY_TRANSCRIPT" && videoId && transcript) {
      activeVideoId = videoId;
      await runVerificationPipeline(videoId, transcript, port);
    } else if (action === "CANCEL_VERIFICATION" && videoId) {
      console.log(`[Background] Cancel requested for ${videoId}`);
      QueueManager.cancel(videoId);
    }
  });

  port.onDisconnect.addListener(() => {
    console.log("[Background] Port disconnected. Cleaning active jobs.");
    if (activeVideoId) QueueManager.cancel(activeVideoId);
  });
});

// ── Main pipeline ──────────────────────────────────────────────────────────────

/**
 * Phase 5 Retrieval-First Verification Pipeline.
 *
 * Decision flow:
 *
 *   Transcript
 *   → Local filters (transcriptFilter → claimFilter)
 *   → Local claim extraction (claimExtractor)
 *   → Verifiability filter  ← NEW (rejects "I'm a dietitian" etc.)
 *   → Claim hash cache       ← checked BEFORE retrieval
 *   → Local classification
 *   → Smart retrieval        ← category-aware, no blanket queries
 *   → Retrieval confidence
 *
 *   if confidence >= 60  → local synthesis → done
 *   if confidence < 60   → Gemini (optional, if key present)
 *                        → OpenRouter (optional, if key present)
 *                        → local synthesis fallback
 *
 * Both Gemini and OpenRouter are optional. The extension produces results
 * from retrieval alone. LLMs only improve synthesis quality when available.
 */
async function runVerificationPipeline(
  videoId: string,
  transcript: string,
  port: chrome.runtime.Port
): Promise<void> {
  postResponse(port, { status: "loading", videoId });

  const signal = QueueManager.register(videoId);

  try {
    // ── Step 1: Load API keys (all optional) ──────────────────────────────────
    const storage = await chrome.storage.local.get([
      "geminiApiKey",
      "openRouterApiKey",
    ]) as { geminiApiKey?: string; openRouterApiKey?: string };

    const geminiApiKey = storage.geminiApiKey || "";
    const openRouterApiKey = storage.openRouterApiKey || "";
    // Google API key (same account as Gemini) powers FactCheck Tools API
    const googleApiKey = geminiApiKey;

    console.log(
      `[Background] Keys: gemini=${geminiApiKey ? "✓" : "✗"}, openRouter=${openRouterApiKey ? "✓" : "✗"}`
    );

    // ── Step 2: Video ID cache ─────────────────────────────────────────────────
    const cachedByVideo = await CacheService.get(videoId);
    if (cachedByVideo) {
      console.log(`[Background] Cache Hit (videoId): ${videoId}`);
      postResponse(port, { status: "completed", videoId, analysis: cachedByVideo });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // ── Step 3: Local claim presence filter ────────────────────────────────────
    // Zero API cost — runs entirely locally
    const filterResult = filterForClaims(transcript);
    console.log(
      `[Background] ClaimFilter: hasClaim=${filterResult.hasPotentialClaim}, ` +
      `confidence=${filterResult.confidence}, patterns=${filterResult.matchedPatterns
        .filter((p) => p !== "__numeric__")
        .slice(0, 4)
        .join(", ") || "(none)"}`
    );

    if (!filterResult.hasPotentialClaim) {
      const noClaimResult: ClaimAnalysis = {
        containsClaim: false,
        isSatire: false,
        reasoning: "Local filter: no factual claim signals detected in transcript.",
        verdict: "No verifiable claims detected",
        credibility: "none",
      };
      await CacheService.set(videoId, null, noClaimResult);
      postResponse(port, { status: "completed", videoId, analysis: noClaimResult });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // ── Step 4: Local claim extraction ────────────────────────────────────────
    const extraction = extractClaimSentences(transcript);
    console.log(
      `[Background] ClaimExtractor: ${extraction.stats.extractedCount}/${extraction.stats.totalSentences} sentences, ` +
      `~${extraction.stats.reductionPercent}% token reduction`
    );

    // ── Step 5: Verifiability filter (NEW) ────────────────────────────────────
    // Rejects personal intros, CTAs, and opinions BEFORE any API call
    const candidates =
      extraction.sentences.length > 0
        ? extraction.sentences
        : [transcript.slice(0, 250).trim()]; // conservative fallback

    const verifiability = filterVerifiableClaim(candidates);
    console.log(
      `[Background] VerifiabilityFilter: isVerifiable=${verifiability.isVerifiable}, ` +
      `reason="${verifiability.reason}"`
    );

    if (!verifiability.isVerifiable) {
      const noVerifiableResult: ClaimAnalysis = {
        containsClaim: false,
        isSatire: false,
        reasoning: `Verifiability filter: ${verifiability.reason}`,
        verdict: "No verifiable claims detected",
        credibility: "none",
      };
      await CacheService.set(videoId, null, noVerifiableResult);
      postResponse(port, { status: "completed", videoId, analysis: noVerifiableResult });
      QueueManager.complete(videoId);
      return;
    }

    const claimText = verifiability.bestClaim;
    console.log(`[Background] Selected claim: "${claimText.slice(0, 100)}"`);

    // ── Step 6: Claim hash cache ──────────────────────────────────────────────
    // Checked HERE — before retrieval — so cached results skip all API calls
    const claimHash = await CacheService.computeClaimHash(claimText);
    const cachedByClaim = await CacheService.getByClaimHash(claimHash);
    if (cachedByClaim) {
      console.log(`[Background] Cache Hit (claimHash): ${claimHash.slice(0, 12)}…`);
      await CacheService.set(videoId, claimHash, cachedByClaim);
      postResponse(port, { status: "completed", videoId, analysis: cachedByClaim });
      QueueManager.complete(videoId);
      return;
    }

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // ── Step 7: Local classification (zero-cost) ──────────────────────────────
    const classification = ClaimClassifier.classify(claimText);
    const category =
      !classification.category || classification.category === "unknown"
        ? "other"
        : classification.category;
    console.log(
      `[Background] Classifier: category="${category}", ` +
      `confidence=${classification.confidence}, keywords=[${classification.matchedKeywords.slice(0, 3).join(", ")}]`
    );

    // ── Step 8: Smart retrieval ───────────────────────────────────────────────
    console.log(`[Background] ==> Smart retrieval START (category=${category})`);
    const evidence = await RetrievalEngine.retrieve(
      claimText,
      category,
      googleApiKey,
      signal
    );

    const factCheckRes = evidence.factCheck ?? null;
    const healthRes = evidence.healthResearch ?? [];
    const newsRes = evidence.newsArticles ?? [];
    const hasEvidence =
      !!factCheckRes || healthRes.length > 0 || newsRes.length > 0;

    console.log(
      `[Background] Retrieval complete: factCheck=${!!factCheckRes}, ` +
      `pubmed=${healthRes.length}, news=${newsRes.length}, hasEvidence=${hasEvidence}`
    );

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // ── Step 9: Retrieval-based confidence ────────────────────────────────────
    const retrievalConfidence = ConfidenceScorer.computeRetrieval(
      { factCheck: factCheckRes, healthResearch: healthRes, newsArticles: newsRes },
      category,
      claimText
    );
    console.log(`[Background] Retrieval confidence: ${retrievalConfidence}`);

    // ── Step 10: Decision engine ──────────────────────────────────────────────
    // Initialize with local synthesis as the guaranteed fallback.
    // TypeScript strict mode requires definite assignment — this ensures it.
    let synthesizedAnalysis: ClaimAnalysis = buildLocalSynthesis(
      claimText, category, retrievalConfidence,
      factCheckRes, healthRes, newsRes
    );

    if (retrievalConfidence >= 60) {
      // Sufficient confidence OR authoritative source hit → local synthesis only
      console.log(
        `[Background] Confidence ${retrievalConfidence} >= 60 (or has evidence) — local synthesis, no LLM.`
      );
      // synthesizedAnalysis already set to local synthesis above — nothing extra to do
    } else {
      // Low confidence + no evidence → try LLM if available
      console.log(
        `[Background] Confidence ${retrievalConfidence} < 60 + no evidence → attempting LLM escalation.`
      );

      // Try Gemini (optional — if key configured)
      if (geminiApiKey && !signal.aborted) {
        try {
          console.log("[Background] Gemini synthesis attempt (optional)...");
          // Dynamic import — SDK not loaded when key is absent
          const { GeminiService } = await import("../services/geminiService");
          const gemini = new GeminiService(geminiApiKey);
          const geminiResult = await gemini.synthesizeVerification(
            claimText,
            category,
            { factCheck: factCheckRes, healthResearch: healthRes, newsArticles: newsRes },
            signal
          );
          // Override default only on success
          synthesizedAnalysis = geminiResult;
          synthesizedAnalysis.claim = synthesizedAnalysis.claim || claimText;
          synthesizedAnalysis.category = synthesizedAnalysis.category || (category as any);
          console.log("[Background] Gemini synthesis succeeded.");
        } catch (geminiErr: any) {
          if (geminiErr?.name === "AbortError") throw geminiErr;
          console.warn(
            "[Background] Gemini failed (non-fatal) — retaining local synthesis:",
            geminiErr?.message
          );
          // synthesizedAnalysis stays as local synthesis default
        }
      } else {
        console.log("[Background] No Gemini key — using local synthesis.");
      }
    }

    if (signal.aborted) throw new DOMException("Aborted", "AbortError");

    // ── Step 11: Attach evidence sub-blocks to analysis ───────────────────────
    if (!synthesizedAnalysis.factCheck) {
      synthesizedAnalysis.factCheck = factCheckRes;
    }
    if (healthRes.length > 0 && !synthesizedAnalysis.healthResearch) {
      synthesizedAnalysis.healthResearch = {
        status: "Scientifically supported",
        summary: synthesizedAnalysis.explanation || "",
        sources: healthRes,
      };
    }
    if (newsRes.length > 0 && !synthesizedAnalysis.newsVerification) {
      synthesizedAnalysis.newsVerification = {
        status: "Widely reported",
        summary: synthesizedAnalysis.explanation || "",
        sources: newsRes,
      };
    }

    // ── Step 12: Final multi-factor confidence scoring ────────────────────────
    const finalScores = ConfidenceScorer.compute(synthesizedAnalysis);
    synthesizedAnalysis.confidence = finalScores.confidence;
    synthesizedAnalysis.scientificSupport = finalScores.scientificSupport;
    synthesizedAnalysis.manipulationRisk = finalScores.manipulationRisk;
    synthesizedAnalysis.evidenceStrength = finalScores.evidenceStrength;

    // ── Step 13: OpenRouter last-resort (optional) ────────────────────────────
    // Only fires when: confidence < 60 AND openRouterApiKey configured
    const openRouterResult = await EscalationManager.escalateIfNeeded(
      claimText,
      evidence,
      finalScores.confidence,
      openRouterApiKey || undefined,
      signal
    );
    if (Object.keys(openRouterResult).length > 0) {
      Object.assign(synthesizedAnalysis, openRouterResult);
      console.log("[Background] OpenRouter result merged.");
    }

    // ── Step 14: Cache (both videoId + claimHash) then respond ───────────────
    await CacheService.set(videoId, claimHash, synthesizedAnalysis);
    postResponse(port, { status: "completed", videoId, analysis: synthesizedAnalysis });

  } catch (error: any) {
    if (error?.name === "AbortError" || signal.aborted) {
      console.log(`[Background] Pipeline aborted for ${videoId}`);
    } else {
      console.error(`[Background] Pipeline error for ${videoId}:`, error);
      postResponse(port, {
        status: "error",
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

/**
 * Builds a ClaimAnalysis from retrieval evidence alone.
 * Used when confidence >= 60 or as LLM fallback.
 * Never returns "none" credibility when evidence exists.
 */
function buildLocalSynthesis(
  claimText: string,
  category: string,
  confidence: number,
  factCheckRes: any,
  healthRes: any[],
  newsRes: any[]
): ClaimAnalysis {
  const hasFactCheck = !!factCheckRes;
  const hasHealth = healthRes.length > 0;
  const hasNews = newsRes.length > 0;
  const hasEvidence = hasFactCheck || hasHealth || hasNews;

  let verdict = "Unverified";
  let credibility: "low" | "medium" | "high" | "none" = hasEvidence ? "medium" : "none";
  let explanation = "No trusted sources could verify this statement at this time.";

  if (hasFactCheck) {
    verdict = factCheckRes.verdict;
    const v = verdict.toLowerCase();
    if (
      v.includes("false") ||
      v.includes("incorrect") ||
      v.includes("fake") ||
      v.includes("misleading") ||
      v.includes("debunk")
    ) {
      credibility = "low";
      explanation = `A fact-checking review found this claim inaccurate: "${factCheckRes.explanation}".`;
    } else {
      credibility = "high";
      explanation = `A fact-checking review corroborates this claim: "${factCheckRes.explanation}".`;
    }
  } else if (hasHealth) {
    verdict = "Scientifically supported";
    credibility = "high";
    explanation = `Peer-reviewed research corroborates this claim (${healthRes.length} paper${healthRes.length !== 1 ? "s" : ""} found).`;
  } else if (hasNews) {
    verdict = "Widely reported";
    credibility = "high";
    explanation = `Credible news sources corroborate this claim (${newsRes.length} report${newsRes.length !== 1 ? "s" : ""} found).`;
  }

  return {
    containsClaim: true,
    claim: claimText,
    category: category as any,
    isSatire: false,
    verdict,
    credibility,
    confidence,
    explanation,
    alternativeExplanation: "Retrieved via local intelligence verification tools.",
    sourceName: hasFactCheck
      ? factCheckRes.source
      : hasHealth
        ? healthRes[0]?.journal
        : newsRes[0]?.source,
    sourceUrl: hasFactCheck
      ? factCheckRes.url
      : hasHealth
        ? healthRes[0]?.url
        : newsRes[0]?.url,
    factCheck: factCheckRes,
    healthResearch: hasHealth
      ? { status: "Scientifically supported", summary: explanation, sources: healthRes }
      : null,
    newsVerification: hasNews
      ? { status: "Widely reported", summary: explanation, sources: newsRes }
      : null,
  };
}
