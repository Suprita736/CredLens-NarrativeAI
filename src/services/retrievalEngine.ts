// src/services/retrievalEngine.ts

import { FactCheckService } from "./factCheckService";
import { HealthService } from "./healthService";
import { NewsService } from "./newsService";
import { ClaimRouter } from "../utils/claimRouter";
import { retryWithDelay } from "../utils/retryUtils";
import type { EvidenceBundle } from "../types";

/**
 * Smart Retrieval Engine — Phase 5.
 *
 * Category-aware routing table (no blanket queries):
 *
 *   health    → PubMed only
 *   science   → PubMed + FactCheck
 *   politics  → FactCheck + News
 *   news      → FactCheck + News
 *   finance   → FactCheck + News
 *   general / other / technology / unknown → FactCheck only
 *
 * The Google API key is used exclusively for FactCheck Tools API.
 * PubMed and Google News RSS require no API key.
 */
export class RetrievalEngine {
  static async retrieve(
    claim: string,
    category: string,
    googleApiKey: string,
    signal?: AbortSignal
  ): Promise<EvidenceBundle> {
    const cat = (category || "other").toLowerCase().trim();

    const usePubMed = ClaimRouter.shouldSearchPubMed(cat);
    const useFactCheck = ClaimRouter.shouldSearchFactCheck(cat);
    const useNews = ClaimRouter.shouldSearchNews(cat);

    console.log(
      `[RetrievalEngine] category="${cat}" → PubMed=${usePubMed}, FactCheck=${useFactCheck}, News=${useNews}`
    );

    // ── Run only the applicable sources concurrently ──────────────────────────

    const factCheckPromise: Promise<any> = useFactCheck
      ? retryWithDelay(
          () => FactCheckService.verifyClaim(claim, googleApiKey, signal),
          1,
          1000,
          signal
        ).catch((err: any) => {
          console.error("[RetrievalEngine] FactCheck failed:", err?.message);
          return null;
        })
      : Promise.resolve(null);

    const pubMedPromise: Promise<any[]> = usePubMed
      ? retryWithDelay(
          () => HealthService.searchPubMed(claim, signal),
          1,
          1000,
          signal
        ).catch((err: any) => {
          console.error("[RetrievalEngine] PubMed failed:", err?.message);
          return [];
        })
      : Promise.resolve([]);

    const newsPromise: Promise<any[]> = useNews
      ? retryWithDelay(
          () => NewsService.searchNews(claim, signal),
          1,
          1000,
          signal
        ).catch((err: any) => {
          console.error("[RetrievalEngine] News failed:", err?.message);
          return [];
        })
      : Promise.resolve([]);

    const [factCheck, healthResearch, newsArticles] = await Promise.all([
      factCheckPromise,
      pubMedPromise,
      newsPromise,
    ]);

    return { factCheck, healthResearch, newsArticles };
  }
}
