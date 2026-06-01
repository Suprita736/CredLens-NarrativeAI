// src/utils/claimRouter.ts

export type VerificationRoute = "health" | "science" | "news_politics" | "finance" | "general";

/**
 * Synchronous claim routing utility.
 * Maps a classification category to the correct set of retrieval sources.
 *
 * Routing table (per Phase 5 spec):
 *   health    → PubMed only
 *   science   → PubMed + FactCheck
 *   politics  → FactCheck + News
 *   news      → FactCheck + News
 *   finance   → FactCheck + News
 *   tech/gen  → FactCheck only
 */
export class ClaimRouter {
  static determineRoute(category: string): VerificationRoute {
    const cat = (category || "").toLowerCase().trim();
    if (cat === "health") return "health";
    if (cat === "science") return "science";
    if (cat === "politics" || cat === "news") return "news_politics";
    if (cat === "finance") return "finance";
    return "general";
  }

  /** True if category should query PubMed (health or science only). */
  static shouldSearchPubMed(category: string): boolean {
    const cat = (category || "").toLowerCase().trim();
    return cat === "health" || cat === "science";
  }

  /**
   * True if category should query Google Fact Check Tools.
   * Health is PubMed-only — FactCheck is NOT used for health claims.
   */
  static shouldSearchFactCheck(category: string): boolean {
    const cat = (category || "").toLowerCase().trim();
    return cat !== "health";
  }

  /**
   * True if category should query Google News RSS.
   * News is only relevant for politics, news, and finance — NOT health or science.
   */
  static shouldSearchNews(category: string): boolean {
    const cat = (category || "").toLowerCase().trim();
    return cat === "politics" || cat === "news" || cat === "finance";
  }
}
