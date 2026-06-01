// src/utils/escalationManager.ts

import { OpenRouterProvider } from "../services/openRouterService";
import { retryWithDelay } from "./retryUtils";
import type { ClaimAnalysis, EvidenceBundle } from "../types";

/**
 * EscalationManager — Phase 5 (Last-Resort LLM, Fully Optional).
 *
 * OpenRouter is NEVER required. If no openRouterApiKey is provided,
 * escalation is skipped silently and the extension continues normally.
 *
 * Escalation triggers only when:
 *   1. confidence < CONFIDENCE_THRESHOLD (60)
 *   2. openRouterApiKey is present in storage
 */
export class EscalationManager {
  private static readonly CONFIDENCE_THRESHOLD = 60;

  static shouldEscalate(confidence: number): boolean {
    return confidence < this.CONFIDENCE_THRESHOLD;
  }

  /**
   * Conditionally escalates to OpenRouter.
   *
   * @param claim         - Verified claim text
   * @param evidence      - Retrieval evidence bundle
   * @param confidence    - Current confidence score (0–100)
   * @param openRouterKey - OpenRouter API key (may be undefined — that's OK)
   * @param signal        - AbortSignal for cancellation
   * @returns Partial<ClaimAnalysis> to merge into synthesized result, or {} if skipped
   */
  static async escalateIfNeeded(
    claim: string,
    evidence: EvidenceBundle,
    confidence: number,
    openRouterKey: string | undefined,
    signal?: AbortSignal
  ): Promise<Partial<ClaimAnalysis>> {
    if (!this.shouldEscalate(confidence)) {
      return {};
    }

    // If no OpenRouter key configured, skip silently — extension still works
    if (!openRouterKey) {
      console.log(
        `[EscalationManager] Confidence ${confidence} < ${this.CONFIDENCE_THRESHOLD} but no OpenRouter key configured — skipping escalation.`
      );
      return {};
    }

    console.log(
      `[EscalationManager] Confidence ${confidence} < ${this.CONFIDENCE_THRESHOLD}. Escalating to OpenRouter...`
    );

    try {
      const provider = new OpenRouterProvider(openRouterKey);
      const result = await retryWithDelay(
        () => provider.analyzeClaim(claim, evidence),
        1,
        1000,
        signal
      );
      console.log("[EscalationManager] OpenRouter escalation completed.");
      return result;
    } catch (err: any) {
      if (err?.name === "AbortError") return {};
      console.warn("[EscalationManager] OpenRouter failed (non-fatal):", err?.message);
      return {};
    }
  }
}
