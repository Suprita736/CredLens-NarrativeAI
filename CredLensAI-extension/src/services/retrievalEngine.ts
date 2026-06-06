// src/services/retrievalEngine.ts — CredLens Narrative Synthesis Architecture
//
// Domain-routed retrieval pipeline.
//
// Retrieval queries come from NarrativeSynthesisService.buildRetrievalQueries(),
// which derives them from central_claim + supporting_claims — NOT transcript words.
//
// Domain routing prioritizes sources based on claim_domain:
//   health/nutrition/medicine → PubMed first, then FactCheck, then News
//   politics/current_events  → News first, then FactCheck
//   science/technology       → PubMed + News
//   default                  → All sources equally

import { FactCheckService } from './factCheckService';
import { HealthService } from './healthService';
import { NewsService } from './newsService';
import { retryWithDelay } from '../utils/retryUtils';
import type { EvidenceBundle } from '../types';

type DomainRoute = 'health' | 'politics' | 'science' | 'general';

function classifyDomain(claimDomain: string): DomainRoute {
  const d = claimDomain.toLowerCase().trim();
  if (['health', 'nutrition', 'medicine'].includes(d)) return 'health';
  if (['politics', 'current_events'].includes(d)) return 'politics';
  if (['science', 'technology'].includes(d)) return 'science';
  return 'general';
}

export class RetrievalEngine {
  /**
   * Retrieve evidence for narrative synthesis queries with domain routing.
   *
   * @param retrievalQueries - Queries derived from synthesis central/supporting claims
   * @param claimDomain - Domain from NarrativeSynthesis.claim_domain
   * @param googleApiKey - Optional Google API key for Fact Check Tools
   * @param signal - AbortSignal for cancellation
   */
  static async retrieve(
    retrievalQueries: string[],
    claimDomain: string,
    googleApiKey: string,
    signal?: AbortSignal
  ): Promise<EvidenceBundle> {
    const route = classifyDomain(claimDomain);
    console.log(`[RetrievalEngine] Domain: "${claimDomain}" → Route: "${route}". Processing ${retrievalQueries.length} queries.`);

    const factChecks: any[] = [];
    const healthResearch: any[] = [];
    const newsArticles: any[] = [];
    let factCheckStatus: 'available' | 'unavailable' = 'available';

    for (const query of retrievalQueries) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      console.log(`[RetrievalEngine] Querying: "${query}" (route=${route})`);

      // Build promise list based on domain routing
      const promises: Promise<void>[] = [];

      // FactCheck — all routes except pure politics-only
      const shouldFactCheck = route !== 'politics' || googleApiKey;
      if (shouldFactCheck && googleApiKey) {
        promises.push(
          retryWithDelay(
            () => FactCheckService.verifyClaim(query, googleApiKey, signal),
            1, 1000, signal
          ).then(fc => { if (fc) factChecks.push(fc); })
           .catch((err: any) => {
             console.error('[RetrievalEngine] FactCheck failed:', err?.message);
             if (err?.message === 'FACTCHECK_403') {
               factCheckStatus = 'unavailable';
             }
           })
        );
      }

      // PubMed — prioritized for health/science, included for general
      if (route === 'health' || route === 'science' || route === 'general') {
        promises.push(
          retryWithDelay(
            () => HealthService.searchPubMed(query, signal),
            1, 1000, signal
          ).then(hr => { if (hr?.length) healthResearch.push(...hr); })
           .catch((err: any) => {
             console.error('[RetrievalEngine] PubMed failed:', err?.message);
           })
        );
      }

      // News — prioritized for politics/current_events, included for all
      promises.push(
        retryWithDelay(
          () => NewsService.searchNews(query, signal),
          1, 1000, signal
        ).then(na => { if (na?.length) newsArticles.push(...na); })
         .catch((err: any) => {
           console.error('[RetrievalEngine] News failed:', err?.message);
         })
      );

      await Promise.all(promises);
    }

    console.log(
      `[RetrievalEngine] Results: factCheck=${factChecks.length}, ` +
      `pubmed=${healthResearch.length}, news=${newsArticles.length}`
    );

    return {
      factCheckStatus,
      factCheck: factChecks[0] || null,
      healthResearch: healthResearch.slice(0, 10),
      newsArticles: newsArticles.slice(0, 10),
    };
  }
}
