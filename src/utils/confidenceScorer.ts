import type { ClaimAnalysis } from "../types";

export interface ConfidenceReport {
  credibilityScore: number;
  confidence: number;
  scientificSupport: "Strong" | "Moderate" | "Weak" | "None" | "N/A";
  manipulationRisk: "High" | "Moderate" | "Low";
  evidenceStrength: "Strong" | "Moderate" | "Weak";
}

/**
 * Retrieval-evidence confidence bundle (used before LLM synthesis).
 */
export interface RetrievalEvidence {
  factCheck: { confidence?: number; verdict?: string } | null;
  healthResearch: any[];
  newsArticles: any[];
}

export class ConfidenceScorer {
  /**
   * computeRetrieval — Phase 5 retrieval-first confidence.
   *
   * Scores ONLY on:
   *   • Source authority    (PubMed > FactCheck > TrustedNews)
   *   • Source relevance    (news articles NEVER boost health claims)
   *   • Source agreement    (multiple sources reaching same verdict)
   *   • Claim specificity   (numeric/named claims score higher)
   *
   * Returns 0–100. Threshold: >= 60 = sufficient for local synthesis.
   */
  static computeRetrieval(
    evidence: RetrievalEvidence,
    category: string,
    claimText: string
  ): number {
    const cat = (category || "other").toLowerCase().trim();
    let score = 0;

    // ── 1. FactCheck (not used for health — per routing table) ────────────────
    // Only for science / politics / news / finance / general
    if (cat !== "health" && evidence.factCheck) {
      // FactCheck carries its own Jaccard-based confidence (50–95)
      // We scale that to contribute max 45 points
      const fcConf = evidence.factCheck.confidence ?? 50;
      score += Math.round((fcConf / 100) * 45);
    }

    // ── 2. PubMed / health research (health & science only) ──────────────────
    if ((cat === "health" || cat === "science") && evidence.healthResearch.length > 0) {
      // Each paper = 15 pts, diminishing after 3 (max 45)
      const paperCount = Math.min(3, evidence.healthResearch.length);
      score += paperCount * 15;
    }

    // ── 3. News (politics / news / finance ONLY — never health or science) ───
    if (
      (cat === "politics" || cat === "news" || cat === "finance") &&
      evidence.newsArticles.length > 0
    ) {
      // Unique sources (diversity) drive the score — not raw count
      const uniqueSources = new Set(
        evidence.newsArticles.map((a: any) => (a.source ?? "unknown").toLowerCase())
      ).size;
      // Max 30 points (3 unique sources × 10)
      score += Math.min(3, uniqueSources) * 10;
    }

    // ── 4. Claim specificity bonus ────────────────────────────────────────────
    // Numeric values (%, mg, billion, etc.) make claims more precisely verifiable
    const hasNumeric =
      /\b\d+(?:\.\d+)?(?:%|mg|mcg|kg|g\b|ml|iu|billion|million|thousand)\b/i.test(claimText);
    if (hasNumeric) score += 5;

    // ── 5. Cross-source agreement bonus ──────────────────────────────────────
    // If multiple source types agree (e.g. FactCheck + PubMed both present)
    const activeSources =
      (evidence.factCheck && cat !== "health" ? 1 : 0) +
      (evidence.healthResearch.length > 0 ? 1 : 0) +
      (evidence.newsArticles.length > 0 && cat !== "health" && cat !== "science" ? 1 : 0);
    if (activeSources >= 2) score += 8;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * compute — final multi-factor scoring after synthesis.
   * Runs on the completed ClaimAnalysis to produce display-ready metrics.
   */
  static compute(analysis: ClaimAnalysis): ConfidenceReport {
    const category = analysis.category || "other";
    const credibility = analysis.credibility || "none";
    const isSatire = analysis.isSatire || false;

    const factCheck = analysis.factCheck;
    const healthResearchCount = analysis.healthResearch?.sources?.length ?? 0;
    const newsArticlesCount = analysis.newsVerification?.sources?.length ?? 0;
    const totalEvidenceCount =
      (factCheck ? 1 : 0) + healthResearchCount + newsArticlesCount;

    // ── 1. Scientific Support ─────────────────────────────────────────────────
    let scientificSupport: ConfidenceReport["scientificSupport"] = "N/A";
    if (category === "health" || category === "science") {
      if (
        healthResearchCount >= 2 &&
        (credibility === "high" ||
          (analysis.verdict ?? "").toLowerCase().includes("support"))
      ) {
        scientificSupport = "Strong";
      } else if (healthResearchCount >= 1) {
        scientificSupport = "Moderate";
      } else if (credibility === "low") {
        scientificSupport = "None";
      } else {
        scientificSupport = "Weak";
      }
    }

    // ── 2. Evidence Strength ─────────────────────────────────────────────────
    let evidenceStrength: ConfidenceReport["evidenceStrength"] = "Weak";
    if (
      (factCheck && (factCheck.confidence ?? 0) >= 80) ||
      healthResearchCount >= 2 ||
      newsArticlesCount >= 2
    ) {
      evidenceStrength = "Strong";
    } else if (totalEvidenceCount >= 1) {
      evidenceStrength = "Moderate";
    }

    // ── 3. Manipulation Risk ─────────────────────────────────────────────────
    let manipulationRisk: ConfidenceReport["manipulationRisk"] = "Moderate";
    const verdictLower = (analysis.verdict ?? "").toLowerCase();
    if (
      isSatire ||
      credibility === "high" ||
      verdictLower.includes("supported") ||
      verdictLower.includes("reported")
    ) {
      manipulationRisk = "Low";
    } else if (
      credibility === "low" ||
      verdictLower.includes("false") ||
      verdictLower.includes("inaccurate") ||
      verdictLower.includes("debunk") ||
      verdictLower.includes("misleading") ||
      verdictLower.includes("no credible evidence")
    ) {
      manipulationRisk = "High";
    }

    // ── 4. Credibility Score (0–100) ─────────────────────────────────────────
    let credibilityScore =
      credibility === "high"
        ? 85
        : credibility === "medium"
        ? 60
        : credibility === "low"
        ? 20
        : 45;

    if (factCheck) {
      const fcv = factCheck.verdict.toLowerCase();
      if (
        fcv.includes("false") ||
        fcv.includes("incorrect") ||
        fcv.includes("fake") ||
        fcv.includes("misleading") ||
        fcv.includes("debunk")
      ) {
        credibilityScore -= 15;
      } else if (
        fcv.includes("true") ||
        fcv.includes("correct") ||
        fcv.includes("accurate")
      ) {
        credibilityScore += 10;
      }
    }

    if (category === "health" || category === "science") {
      if (scientificSupport === "Strong") credibilityScore += 10;
      else if (scientificSupport === "None") credibilityScore -= 15;
    }

    if (category === "news" || category === "politics") {
      if (newsArticlesCount >= 2 && credibility === "high") credibilityScore += 8;
      else if (newsArticlesCount === 0 && credibility === "low") credibilityScore -= 10;
    }

    if (isSatire) credibilityScore = 95;
    credibilityScore = Math.max(5, Math.min(95, credibilityScore));

    // ── 5. Confidence Score (0–100) ──────────────────────────────────────────
    let baseConfidence = analysis.confidence ?? 65;

    if (factCheck) baseConfidence += 15;
    if (healthResearchCount > 0)
      baseConfidence += healthResearchCount === 1 ? 10 : 15;
    // News confidence only added for non-health categories
    if (newsArticlesCount > 0 && category !== "health" && category !== "science")
      baseConfidence += Math.min(15, newsArticlesCount * 5);
    if (totalEvidenceCount === 0) baseConfidence -= 15;

    const confidence = Math.max(30, Math.min(95, baseConfidence));

    return { credibilityScore, confidence, scientificSupport, manipulationRisk, evidenceStrength };
  }
}
