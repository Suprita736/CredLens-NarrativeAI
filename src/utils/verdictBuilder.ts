// src/utils/verdictBuilder.ts — CredLens NarrativeAI Phase 1
//
// Local verdict builder. Generates narrative verdicts entirely from
// evidence without requiring any LLM. Uses evidence-driven templates
// to produce human-readable, educational verdicts.
//
// This is the PRIMARY verdict generation mechanism.
// Gemini/OpenRouter are fallbacks for extreme edge cases only.

import type {
  NarrativeAnalysis,
  NarrativeVerdict,
  CredibilityLevel,
  EvidenceBundle,
  FactCheckResult,
  ResearchArticle,
  NewsArticle,
} from '../types';

// ── Evidence scoring ───────────────────────────────────────────────────────────

interface EvidenceScore {
  total: number;
  factCheckScore: number;
  researchScore: number;
  newsScore: number;
  sourceCount: number;
  hasConflicts: boolean;
}

function scoreEvidence(evidence: EvidenceBundle): EvidenceScore {
  const factCheck = evidence.factCheck ?? null;
  const research = evidence.healthResearch ?? [];
  const news = evidence.newsArticles ?? [];

  let factCheckScore = 0;
  if (factCheck) {
    factCheckScore = factCheck.confidence ?? 50;
    const v = factCheck.verdict.toLowerCase();
    if (v.includes('false') || v.includes('misleading') || v.includes('debunk')) {
      factCheckScore = Math.max(factCheckScore, 70); // strong negative signal
    }
  }

  const researchScore = Math.min(45, research.length * 15);
  const newsScore = Math.min(30, news.length * 10);

  const sourceCount =
    (factCheck ? 1 : 0) + research.length + news.length;

  // Detect conflicts: factcheck says false but research says supported
  let hasConflicts = false;
  if (factCheck && research.length > 0) {
    const fcVerdict = factCheck.verdict.toLowerCase();
    if (fcVerdict.includes('false') || fcVerdict.includes('misleading')) {
      hasConflicts = true; // factcheck contradicts research presence
    }
  }

  const total = Math.min(100, factCheckScore + researchScore + newsScore);

  return { total, factCheckScore, researchScore, newsScore, sourceCount, hasConflicts };
}

// ── Verdict determination ──────────────────────────────────────────────────────

function determineVerdict(
  score: EvidenceScore,
  factCheck: FactCheckResult | null
): { verdict: NarrativeVerdict; credibility: CredibilityLevel } {
  // Conflicts → mixed evidence
  if (score.hasConflicts) {
    return { verdict: 'Evidence is mixed', credibility: 'medium' };
  }

  // Strong factcheck negative
  if (factCheck) {
    const v = factCheck.verdict.toLowerCase();
    if (v.includes('false') || v.includes('incorrect') || v.includes('fake') || v.includes('debunk')) {
      return { verdict: 'Not supported by evidence', credibility: 'low' };
    }
    if (v.includes('misleading') || v.includes('exaggerat') || v.includes('partly')) {
      return { verdict: 'Exaggerated claim', credibility: 'low' };
    }
    if (v.includes('true') || v.includes('correct') || v.includes('accurate')) {
      return { verdict: 'Supported by evidence', credibility: 'high' };
    }
    // Neutral factcheck
    return { verdict: 'Evidence is mixed', credibility: 'medium' };
  }

  // Research-based scoring
  if (score.researchScore >= 30) {
    return { verdict: 'Supported by evidence', credibility: 'high' };
  }

  // News-based scoring
  if (score.newsScore >= 20) {
    return { verdict: 'Supported by evidence', credibility: 'high' };
  }

  // Some evidence but not strong
  if (score.sourceCount >= 1) {
    return { verdict: 'Evidence is mixed', credibility: 'medium' };
  }

  // No evidence at all
  return { verdict: 'Insufficient evidence', credibility: 'none' };
}

// ── Explanation templates ──────────────────────────────────────────────────────

function buildExplanation(
  verdict: NarrativeVerdict,
  factCheck: FactCheckResult | null,
  research: ResearchArticle[],
  news: NewsArticle[]
): string {
  switch (verdict) {
    case 'Supported by evidence': {
      const parts: string[] = [];
      if (factCheck) {
        parts.push(`A fact-checking review corroborates the narrative: "${factCheck.explanation}".`);
      }
      if (research.length > 0) {
        parts.push(
          `${research.length} peer-reviewed ${research.length === 1 ? 'paper' : 'papers'} found ` +
          `in PubMed support this narrative.`
        );
      }
      if (news.length > 0) {
        parts.push(
          `${news.length} credible news ${news.length === 1 ? 'source' : 'sources'} ` +
          `corroborate this narrative.`
        );
      }
      return parts.join(' ') || 'Available evidence supports the claims made in this video.';
    }

    case 'Not supported by evidence': {
      if (factCheck) {
        return (
          `A fact-checking review found the claims in this narrative to be inaccurate: ` +
          `"${factCheck.explanation}". Current scientific evidence does not support these assertions.`
        );
      }
      return 'No trusted sources could verify the claims made in this video. Exercise caution with this information.';
    }

    case 'Exaggerated claim':
      return (
        'The video largely exaggerates its claims. While there may be a kernel of truth, ' +
        'the assertions as presented are not supported by the weight of current evidence.'
      );

    case 'Evidence is mixed':
      return (
        'Available evidence is mixed regarding the claims in this video. Some sources ' +
        'partially support the narrative, while others contradict it. Consider consulting ' +
        'multiple authoritative sources.'
      );

    case 'Insufficient evidence':
      return (
        'No supporting external evidence could be found to verify the claims in this video. ' +
        'This does not necessarily mean the claims are false, but they could not be verified.'
      );

    default:
      return 'No supporting external reports could be found to verify this narrative.';
  }
}

function buildContext(
  verdict: NarrativeVerdict,
  research: ResearchArticle[],
  news: NewsArticle[]
): string {
  if (verdict === 'Not supported by evidence' || verdict === 'Exaggerated claim') {
    return 'Consider consulting peer-reviewed sources, established health organizations, or trusted news outlets for accurate information on this topic.';
  }
  if (verdict === 'Evidence is mixed') {
    return 'Scientific understanding evolves over time. Look for recent systematic reviews or meta-analyses for the most reliable conclusions.';
  }
  if (research.length > 0) {
    return `Evidence sourced from ${research.length} peer-reviewed publication${research.length !== 1 ? 's' : ''} via PubMed.`;
  }
  if (news.length > 0) {
    return `Verified against ${news.length} credible news report${news.length !== 1 ? 's' : ''}.`;
  }
  return 'Retrieved via local intelligence verification tools.';
}

// ── Confidence scoring ─────────────────────────────────────────────────────────

interface ConfidenceBreakdown {
  confidence: number;
  scientificSupport: 'Strong' | 'Moderate' | 'Weak' | 'None' | 'N/A';
  manipulationRisk: 'High' | 'Moderate' | 'Low';
  evidenceStrength: 'Strong' | 'Moderate' | 'Weak';
}

function computeConfidence(
  score: EvidenceScore,
  verdict: NarrativeVerdict
): ConfidenceBreakdown {
  // Base confidence from evidence score
  let confidence = Math.min(95, Math.max(30, score.total));

  // Scientific support
  let scientificSupport: ConfidenceBreakdown['scientificSupport'] = 'N/A';
  if (score.researchScore > 0) {
    if (score.researchScore >= 30) scientificSupport = 'Strong';
    else if (score.researchScore >= 15) scientificSupport = 'Moderate';
    else scientificSupport = 'Weak';
  }

  // Evidence strength
  let evidenceStrength: ConfidenceBreakdown['evidenceStrength'] = 'Weak';
  if (score.sourceCount >= 3 || score.total >= 60) evidenceStrength = 'Strong';
  else if (score.sourceCount >= 1) evidenceStrength = 'Moderate';

  // Manipulation risk
  let manipulationRisk: ConfidenceBreakdown['manipulationRisk'] = 'Moderate';
  if (verdict === 'Supported by evidence') manipulationRisk = 'Low';
  else if (verdict === 'Not supported by evidence' || verdict === 'Exaggerated claim') {
    manipulationRisk = 'High';
  }

  // Adjust confidence based on verdict
  if (verdict === 'Not supported by evidence') confidence = Math.max(confidence, 65);
  if (verdict === 'Insufficient evidence') confidence = Math.min(confidence, 40);

  return { confidence, scientificSupport, manipulationRisk, evidenceStrength };
}

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * Build a complete NarrativeAnalysis from evidence alone.
 * No LLM required. Uses evidence-driven templates.
 */
export function buildVerdict(
  evidence: EvidenceBundle,
  retrievalQuery: string
): NarrativeAnalysis {
  const factCheck = evidence.factCheck ?? null;
  const research = evidence.healthResearch ?? [];
  const news = evidence.newsArticles ?? [];

  const score = scoreEvidence(evidence);
  const { verdict, credibility } = determineVerdict(score, factCheck);
  const explanation = buildExplanation(verdict, factCheck, research, news);
  const context = buildContext(verdict, research, news);
  const { confidence, scientificSupport, manipulationRisk, evidenceStrength } =
    computeConfidence(score, verdict);

  const analysis: NarrativeAnalysis = {
    containsClaims: true,
    verdict,
    credibility,
    confidence,
    explanation,
    context,
    retrievalQuery,
    isSatire: false,

    // Evidence sub-blocks
    factCheck,
    healthResearch: research.length > 0
      ? { status: 'Scientifically supported', summary: explanation, sources: research }
      : null,
    newsVerification: news.length > 0
      ? { status: 'Widely reported', summary: explanation, sources: news }
      : null,

    // Confidence breakdown
    scientificSupport,
    manipulationRisk,
    evidenceStrength,

    // Source attribution
    sourceName: factCheck?.source ?? research[0]?.journal ?? news[0]?.source,
    sourceUrl: factCheck?.url ?? research[0]?.url ?? news[0]?.url,
  };

  return analysis;
}

/**
 * Build a "no claims" analysis result.
 */
export function buildNoClaimsVerdict(reason: string): NarrativeAnalysis {
  return {
    containsClaims: false,
    verdict: 'No verifiable claims detected',
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
    verdict: 'Satirical / Entertainment',
    credibility: 'high',
    confidence: 90,
    explanation: 'This content appears to be satirical or entertainment-focused.',
    isSatire: true,
  };
}
