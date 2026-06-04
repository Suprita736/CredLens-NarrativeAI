// src/utils/verdictBuilder.ts — CredLens Narrative Synthesis Architecture
//
// 4-axis confidence scoring and verdict generation.
//
// Confidence Score:
//   0-30 Source Authority
//   0-30 Evidence Relevance
//   0-20 Hedging Level
//   0-20 Multi-source Corroboration
//
// Verdicts:
//   Supported           (>= 65)
//   Exaggerated          (40-64)
//   Misleading           (20-39)
//   Insufficient Evidence (< 20)

import type {
  NarrativeAnalysis,
  NarrativeVerdict,
  CredibilityLevel,
  EvidenceBundle,
  ConfidenceBreakdown,
  NarrativeSynthesis,
  FactCheckResult,
  ResearchArticle,
  NewsArticle,
} from '../types';

// ── Trusted source list ────────────────────────────────────────────────────────

const TRUSTED_NEWS = new Set([
  'reuters', 'associated press', 'ap news', 'bbc', 'bbc news',
  'bloomberg', 'cnbc', 'the guardian', 'the new york times',
  'the washington post', 'npr', 'pbs', 'cnn', 'cbs news', 'abc news',
  'nbc news', 'who', 'cdc', 'nih',
]);

function isTrustedSource(source: string): boolean {
  return TRUSTED_NEWS.has(source.toLowerCase().trim());
}

// ── Source Authority (0-30) ────────────────────────────────────────────────────

function scoreSourceAuthority(evidence: EvidenceBundle): number {
  let score = 0;

  // FactCheck source = 30 (highest authority)
  if (evidence.factCheck) {
    score = Math.max(score, 30);
  }

  // PubMed = 25
  if (evidence.healthResearch && evidence.healthResearch.length > 0) {
    score = Math.max(score, 25);
  }

  // Trusted news = 15, unknown news = 5
  if (evidence.newsArticles && evidence.newsArticles.length > 0) {
    const hasTrusted = evidence.newsArticles.some(a => isTrustedSource(a.source));
    score = Math.max(score, hasTrusted ? 15 : 5);
  }

  return score;
}

// ── Evidence Relevance (0-30) ──────────────────────────────────────────────────

function scoreEvidenceRelevance(
  evidence: EvidenceBundle,
  retrievalQueryCount: number
): number {
  if (retrievalQueryCount === 0) return 0;

  // Count how many source types returned results
  let sourcesWithResults = 0;
  if (evidence.factCheck) sourcesWithResults++;
  if (evidence.healthResearch && evidence.healthResearch.length > 0) sourcesWithResults++;
  if (evidence.newsArticles && evidence.newsArticles.length > 0) sourcesWithResults++;

  // Scale by coverage: 1 source = 10, 2 sources = 20, 3 sources = 30
  return Math.min(30, sourcesWithResults * 10);
}

// ── Hedging Level (0-20) ───────────────────────────────────────────────────────

function scoreHedging(hedgingLevel: string): number {
  // Well-hedged claims are more credible (creator isn't making absolute claims)
  switch (hedgingLevel) {
    case 'high': return 20;
    case 'moderate': return 15;
    case 'low': return 8;
    case 'none': return 0;   // Bold absolute claims = lower score
    default: return 10;
  }
}

// ── Multi-source Corroboration (0-20) ──────────────────────────────────────────

function scoreCorroboration(evidence: EvidenceBundle): number {
  let sourceTypes = 0;
  if (evidence.factCheck) sourceTypes++;
  if (evidence.healthResearch && evidence.healthResearch.length > 0) sourceTypes++;
  if (evidence.newsArticles && evidence.newsArticles.length > 0) sourceTypes++;

  // Also count total individual sources
  const totalSources =
    (evidence.factCheck ? 1 : 0) +
    (evidence.healthResearch?.length ?? 0) +
    (evidence.newsArticles?.length ?? 0);

  // Base: source types × 5 = max 15, then bonus for volume
  let score = sourceTypes * 5;
  if (totalSources >= 5) score += 5;
  else if (totalSources >= 3) score += 3;

  return Math.min(20, score);
}

// ── Compute full confidence breakdown ──────────────────────────────────────────

function computeConfidence(
  evidence: EvidenceBundle,
  synthesis: NarrativeSynthesis,
  retrievalQueryCount: number
): ConfidenceBreakdown {
  const sourceAuthority = scoreSourceAuthority(evidence);
  const evidenceRelevance = scoreEvidenceRelevance(evidence, retrievalQueryCount);
  const hedgingLevel = scoreHedging(synthesis.hedging_level);
  const multiSourceCorroboration = scoreCorroboration(evidence);

  const total = sourceAuthority + evidenceRelevance + hedgingLevel + multiSourceCorroboration;

  return {
    sourceAuthority,
    evidenceRelevance,
    hedgingLevel,
    multiSourceCorroboration,
    total: Math.min(100, total),
  };
}

// ── Verdict determination ──────────────────────────────────────────────────────

function determineVerdict(
  confidenceTotal: number,
  factCheck: FactCheckResult | null
): { verdict: NarrativeVerdict; credibility: CredibilityLevel } {
  // If factcheck explicitly says false/misleading, override confidence
  if (factCheck) {
    const v = factCheck.verdict.toLowerCase();
    if (v.includes('false') || v.includes('incorrect') || v.includes('fake') || v.includes('debunk')) {
      return { verdict: 'Misleading', credibility: 'low' };
    }
    if (v.includes('misleading') || v.includes('exaggerat') || v.includes('partly')) {
      return { verdict: 'Exaggerated', credibility: 'low' };
    }
  }

  // Confidence-based verdict
  if (confidenceTotal >= 65) {
    return { verdict: 'Supported', credibility: 'high' };
  }
  if (confidenceTotal >= 40) {
    return { verdict: 'Exaggerated', credibility: 'medium' };
  }
  if (confidenceTotal >= 20) {
    return { verdict: 'Misleading', credibility: 'low' };
  }
  return { verdict: 'Insufficient Evidence', credibility: 'none' };
}

// ── Explanation builder ────────────────────────────────────────────────────────

function buildExplanation(
  verdict: NarrativeVerdict,
  synthesis: NarrativeSynthesis,
  factCheck: FactCheckResult | null,
  research: ResearchArticle[],
  news: NewsArticle[],
  breakdown: ConfidenceBreakdown
): string {
  const parts: string[] = [];

  // Narrative summary
  parts.push(`Narrative Summary:\n"${synthesis.narrative_summary}"\n`);

  // Central claim
  parts.push(`Central Claim:\n"${synthesis.central_claim}"\n`);

  // Supporting claims
  if (synthesis.supporting_claims.length > 0) {
    parts.push(`Supporting Claims:\n${synthesis.supporting_claims.map(c => `- ${c}`).join('\n')}\n`);
  }

  // Evidence sources
  const evidenceSources: string[] = [];
  if (factCheck) evidenceSources.push(`FactCheck: ${factCheck.source} — "${factCheck.verdict}"`);
  research.forEach(r => evidenceSources.push(`PubMed: ${r.journal}`));
  news.forEach(n => evidenceSources.push(`News: ${n.source}`));

  if (evidenceSources.length > 0) {
    parts.push(`Evidence:\n${evidenceSources.map(s => `- ${s}`).join('\n')}\n`);
  } else {
    parts.push(`Evidence:\n- None found\n`);
  }

  // Confidence
  parts.push(`Confidence: ${breakdown.total}/100 (Authority: ${breakdown.sourceAuthority}/30, Relevance: ${breakdown.evidenceRelevance}/30, Hedging: ${breakdown.hedgingLevel}/20, Corroboration: ${breakdown.multiSourceCorroboration}/20)\n`);

  // Verdict
  parts.push(`Verdict: ${verdict}`);

  return parts.join('\n');
}

function buildContext(
  verdict: NarrativeVerdict,
  _synthesis: NarrativeSynthesis,
  research: ResearchArticle[],
  news: NewsArticle[]
): string {
  if (verdict === 'Misleading') {
    return 'Consider consulting peer-reviewed sources, established health organizations, or trusted news outlets for accurate information on this topic.';
  }
  if (verdict === 'Exaggerated') {
    return 'Some claims in this video appear overstated. Look for recent systematic reviews or meta-analyses for the most reliable conclusions.';
  }
  if (research.length > 0) {
    return `Evidence sourced from ${research.length} peer-reviewed publication${research.length !== 1 ? 's' : ''} via PubMed.`;
  }
  if (news.length > 0) {
    return `Verified against ${news.length} credible news report${news.length !== 1 ? 's' : ''}.`;
  }
  return 'Insufficient external evidence to verify. Use critical thinking when evaluating these claims.';
}

// ── Main export ────────────────────────────────────────────────────────────────

export function buildVerdict(
  evidence: EvidenceBundle,
  synthesis: NarrativeSynthesis,
  retrievalQueryCount: number
): NarrativeAnalysis {
  const factCheck = evidence.factCheck ?? null;
  const research = evidence.healthResearch ?? [];
  const news = evidence.newsArticles ?? [];

  const breakdown = computeConfidence(evidence, synthesis, retrievalQueryCount);
  const { verdict, credibility } = determineVerdict(breakdown.total, factCheck);
  const explanation = buildExplanation(verdict, synthesis, factCheck, research, news, breakdown);
  const context = buildContext(verdict, synthesis, research, news);

  return {
    containsClaims: true,
    verdict,
    credibility,
    confidence: breakdown.total,
    explanation,
    context,
    retrievalQueries: [],  // Will be set by the pipeline
    centralClaim: synthesis.central_claim,
    supportingClaims: synthesis.supporting_claims,
    narrativeSummary: synthesis.narrative_summary,
    claimDomain: synthesis.claim_domain,
    isSatire: false,

    factCheck,
    healthResearch: research.length > 0
      ? { status: 'Scientifically supported', summary: explanation, sources: research }
      : null,
    newsVerification: news.length > 0
      ? { status: 'Widely reported', summary: explanation, sources: news }
      : null,

    confidenceBreakdown: breakdown,

    sourceName: factCheck?.source ?? research[0]?.journal ?? news[0]?.source,
    sourceUrl: factCheck?.url ?? research[0]?.url ?? news[0]?.url,
  };
}

/**
 * Build a "no claims" analysis result.
 */
export function buildNoClaimsVerdict(reason: string): NarrativeAnalysis {
  return {
    containsClaims: false,
    verdict: 'Insufficient Evidence',
    credibility: 'none',
    confidence: 0,
    explanation: reason,
    isSatire: false,
  };
}

/**
 * Build a satire/entertainment analysis result.
 */
export function buildSatireVerdict(): NarrativeAnalysis {
  return {
    containsClaims: false,
    verdict: 'Supported',
    credibility: 'high',
    confidence: 90,
    explanation: 'This content appears to be satirical or entertainment-focused.',
    isSatire: true,
  };
}
