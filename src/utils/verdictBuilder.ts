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
  // If retrieval evidence weak -> Insufficient evidence
  if (score.sourceCount === 0 || score.total < 15) {
    return { verdict: 'Insufficient evidence', credibility: 'none' };
  }

  // Conflicts or some support / some contradict -> Mixed evidence
  if (score.hasConflicts || (score.total >= 15 && score.total < 40)) {
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
    return { verdict: 'Evidence is mixed', credibility: 'medium' };
  }

  // Only return Supported by evidence when strong evidence exists
  if (score.researchScore >= 30 || score.newsScore >= 30 || score.total >= 40) {
    return { verdict: 'Supported by evidence', credibility: 'high' };
  }

  return { verdict: 'Evidence is mixed', credibility: 'medium' };
}

// ── Explanation templates ──────────────────────────────────────────────────────

function buildExplanation(
  verdict: NarrativeVerdict,
  factCheck: FactCheckResult | null,
  research: ResearchArticle[],
  news: NewsArticle[],
  summary: string,
  claims: string[]
): string {
  const parts: string[] = [];
  
  parts.push(`Narrative Summary:\n"${summary}"\n`);
  
  if (claims && claims.length > 0) {
    parts.push(`Claims Identified:\n${claims.map(c => `- ${c}`).join('\n')}\n`);
  }

  const evidenceSources: string[] = [];
  if (factCheck) evidenceSources.push(`FactCheck: ${factCheck.source}`);
  research.forEach(r => evidenceSources.push(`PubMed: ${r.journal}`));
  news.forEach(n => evidenceSources.push(`News: ${n.source}`));

  if (evidenceSources.length > 0) {
    parts.push(`Evidence:\n${evidenceSources.map(s => `- ${s}`).join('\n')}\n`);
  } else {
    parts.push(`Evidence:\n- None found\n`);
  }

  let finalVerdictStr: string = verdict;
  if (verdict === 'Evidence is mixed') finalVerdictStr = 'Mixed evidence found.';
  else if (verdict === 'Supported by evidence') finalVerdictStr = 'Supported by strong evidence.';
  else if (verdict === 'Insufficient evidence') finalVerdictStr = 'Insufficient evidence to verify.';

  parts.push(`Verdict:\n${finalVerdictStr}`);

  return parts.join('\n');
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
  let confidence = Math.min(95, Math.max(30, score.total));

  let scientificSupport: ConfidenceBreakdown['scientificSupport'] = 'N/A';
  if (score.researchScore > 0) {
    if (score.researchScore >= 30) scientificSupport = 'Strong';
    else if (score.researchScore >= 15) scientificSupport = 'Moderate';
    else scientificSupport = 'Weak';
  }

  let evidenceStrength: ConfidenceBreakdown['evidenceStrength'] = 'Weak';
  if (score.sourceCount >= 3 || score.total >= 60) evidenceStrength = 'Strong';
  else if (score.sourceCount >= 1) evidenceStrength = 'Moderate';

  let manipulationRisk: ConfidenceBreakdown['manipulationRisk'] = 'Moderate';
  if (verdict === 'Supported by evidence') manipulationRisk = 'Low';
  else if (verdict === 'Not supported by evidence' || verdict === 'Exaggerated claim') {
    manipulationRisk = 'High';
  }

  if (verdict === 'Not supported by evidence') confidence = Math.max(confidence, 65);
  if (verdict === 'Insufficient evidence') confidence = Math.min(confidence, 40);

  return { confidence, scientificSupport, manipulationRisk, evidenceStrength };
}

// ── Main export ────────────────────────────────────────────────────────────────

export function buildVerdict(
  evidence: EvidenceBundle,
  narrative: { transcript: string, retrievalQueries?: string[], claimsIdentified?: string[] }
): NarrativeAnalysis {
  const factCheck = evidence.factCheck ?? null;
  const research = evidence.healthResearch ?? [];
  const news = evidence.newsArticles ?? [];

  const score = scoreEvidence(evidence);
  const { verdict, credibility } = determineVerdict(score, factCheck);
  
  // Extract summary from transcript for the explanation output (up to 200 chars)
  const summary = narrative.claimsIdentified && narrative.claimsIdentified.length > 0 
    ? narrative.claimsIdentified.join(' ')
    : narrative.transcript.slice(0, 200);

  const explanation = buildExplanation(verdict, factCheck, research, news, summary, narrative.claimsIdentified || []);
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
    retrievalQueries: narrative.retrievalQueries || [],
    claimsIdentified: narrative.claimsIdentified || [],
    isSatire: false,

    factCheck,
    healthResearch: research.length > 0
      ? { status: 'Scientifically supported', summary: explanation, sources: research }
      : null,
    newsVerification: news.length > 0
      ? { status: 'Widely reported', summary: explanation, sources: news }
      : null,

    scientificSupport,
    manipulationRisk,
    evidenceStrength,

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
