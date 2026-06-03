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
    narrativeQueries: string[],
    googleApiKey: string,
    signal?: AbortSignal
  ): Promise<EvidenceBundle> {
    console.log(`[RetrievalEngine] Processing ${narrativeQueries.length} queries.`);

    const factChecks: any[] = [];
    const healthResearch: any[] = [];
    const newsArticles: any[] = [];

    for (const query of narrativeQueries) {
      console.log(`[RetrievalEngine] Querying: "${query}"`);
      
      const factCheckPromise = googleApiKey
        ? retryWithDelay(
            () => FactCheckService.verifyClaim(query, googleApiKey, signal),
            1, 1000, signal
          ).catch((err: any) => {
            console.error('[RetrievalEngine] FactCheck failed:', err?.message);
            return null;
          })
        : Promise.resolve(null);

      const pubMedPromise = retryWithDelay(
        () => HealthService.searchPubMed(query, signal),
        1, 1000, signal
      ).catch((err: any) => {
        console.error('[RetrievalEngine] PubMed failed:', err?.message);
        return [];
      });

      const newsPromise = retryWithDelay(
        () => NewsService.searchNews(query, signal),
        1, 1000, signal
      ).catch((err: any) => {
        console.error('[RetrievalEngine] News failed:', err?.message);
        return [];
      });

      const [fc, hr, na] = await Promise.all([factCheckPromise, pubMedPromise, newsPromise]);
      
      if (fc) factChecks.push(fc);
      if (hr && hr.length) healthResearch.push(...hr);
      if (na && na.length) newsArticles.push(...na);
    }

    console.log(
      `[RetrievalEngine] Results: factCheck=${factChecks.length}, ` +
      `pubmed=${healthResearch.length}, news=${newsArticles.length}`
    );

    return { 
      factCheck: factChecks[0] || null, // Just take the first valid factcheck for now
      healthResearch: healthResearch.slice(0, 10), // Limit total pooled results
      newsArticles: newsArticles.slice(0, 10)
    };
  }
}
