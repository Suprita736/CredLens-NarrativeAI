// src/services/retrievalEngine.ts — CredLens NarrativeAI Phase 1
//
// Narrative-driven retrieval pipeline.
// Retrieval operates on the narrative representation, not individual claims.
//
// Narrative → retrieval query → evidence
//
// Sources kept: PubMed, Google Fact Check, Google News RSS.
// All sources receive the narrative-derived query.

import { FactCheckService } from './factCheckService';
import { HealthService } from './healthService';
import { NewsService } from './newsService';
import { retryWithDelay } from '../utils/retryUtils';
import type { EvidenceBundle } from '../types';

/**
 * Narrative Retrieval Engine — Phase 1.
 *
 * All three sources are queried with the narrative-derived query.
 * No category-based routing — the narrative itself determines relevance.
 * Each source filters by its own relevance internally.
 */
export class RetrievalEngine {
  /**
   * Retrieve evidence for a narrative representation.
   *
   * @param narrativeQuery - The retrieval query derived from the narrative
   * @param googleApiKey - Optional Google API key for Fact Check Tools
   * @param signal - AbortSignal for cancellation
   */
  static async retrieve(
    narrativeQuery: string,
    googleApiKey: string,
    signal?: AbortSignal
  ): Promise<EvidenceBundle> {
    console.log(`[RetrievalEngine] Narrative query: "${narrativeQuery.slice(0, 120)}…"`);

    // Run all three sources concurrently with the same narrative query
    const factCheckPromise: Promise<any> = googleApiKey
      ? retryWithDelay(
          () => FactCheckService.verifyClaim(narrativeQuery, googleApiKey, signal),
          1, 1000, signal
        ).catch((err: any) => {
          console.error('[RetrievalEngine] FactCheck failed:', err?.message);
          return null;
        })
      : Promise.resolve(null);

    const pubMedPromise: Promise<any[]> = retryWithDelay(
      () => HealthService.searchPubMed(narrativeQuery, signal),
      1, 1000, signal
    ).catch((err: any) => {
      console.error('[RetrievalEngine] PubMed failed:', err?.message);
      return [];
    });

    const newsPromise: Promise<any[]> = retryWithDelay(
      () => NewsService.searchNews(narrativeQuery, signal),
      1, 1000, signal
    ).catch((err: any) => {
      console.error('[RetrievalEngine] News failed:', err?.message);
      return [];
    });

    const [factCheck, healthResearch, newsArticles] = await Promise.all([
      factCheckPromise,
      pubMedPromise,
      newsPromise,
    ]);

    console.log(
      `[RetrievalEngine] Results: factCheck=${!!factCheck}, ` +
      `pubmed=${healthResearch.length}, news=${newsArticles.length}`
    );

    return { factCheck, healthResearch, newsArticles };
  }
}
