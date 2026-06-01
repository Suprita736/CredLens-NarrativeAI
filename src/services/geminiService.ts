// src/services/geminiService.ts — CredLens NarrativeAI Phase 1
//
// Gemini fallback service. NOT a primary architecture component.
// Only used when evidence confidence is extremely low AND API key is configured.

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { NarrativeAnalysis, EvidenceBundle } from '../types';

// ── Retry with backoff ─────────────────────────────────────────────────────────

async function withBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 2,
  baseDelay = 1200,
  signal?: AbortSignal
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      if (err?.name === 'AbortError' || signal?.aborted) throw err;
      const isRetryable = err?.status === 429 || err?.status === 503 || err?.status === 500;
      if (!isRetryable || attempt >= maxRetries) throw err;
      const jitter = 0.8 + Math.random() * 0.4;
      const delay = baseDelay * Math.pow(2, attempt) * jitter;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, delay);
        signal?.addEventListener('abort', () => {
          clearTimeout(t);
          reject(new DOMException('Aborted', 'AbortError'));
        });
      });
    }
  }
  throw lastError;
}

// ── GeminiService ──────────────────────────────────────────────────────────────

export class GeminiService {
  private model: any;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  /**
   * Synthesize a narrative verification using Gemini.
   * Only called as a LAST RESORT when local verdict is insufficient.
   */
  async synthesizeNarrative(
    narrativeQuery: string,
    evidence: EvidenceBundle,
    signal?: AbortSignal
  ): Promise<NarrativeAnalysis> {
    const evidenceSummary = JSON.stringify(
      {
        factCheck: evidence.factCheck,
        healthResearch: (evidence.healthResearch ?? []).slice(0, 3),
        newsArticles: (evidence.newsArticles ?? []).slice(0, 3),
      },
      null,
      2
    ).slice(0, 3000);

    const prompt = `
You are an impartial narrative verification assistant for a browser extension.

Narrative summary: "${narrativeQuery.slice(0, 500)}"

External evidence gathered:
${evidenceSummary}

RULES:
• Analyze the OVERALL NARRATIVE, not individual claims in isolation.
• Use phrases like "The video largely exaggerates...", "Current evidence does not support...",
  "This narrative is consistent with scientific understanding..."
• Be educational, neutral, trust-building. Never accusatory.
• Verdict must be one of: "Supported by evidence", "Evidence is mixed",
  "Not supported by evidence", "Exaggerated claim", "Insufficient evidence"

Reply with ONLY valid JSON:
{
  "containsClaims": true,
  "verdict": "verdict string",
  "credibility": "low|medium|high",
  "confidence": 0-100,
  "explanation": "1-3 sentences about the overall narrative",
  "context": "helpful context for the viewer",
  "isSatire": false
}
`.trim();

    try {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const result = await withBackoff(
        () => this.model.generateContent(prompt),
        2, 1500, signal
      ) as any;
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const text: string = result.response.text();
      const jsonStr = text.replace(/```json|```/gi, '').trim();
      return JSON.parse(jsonStr) as NarrativeAnalysis;
    } catch (err: any) {
      if (err?.name === 'AbortError') throw err;
      console.error('[GeminiService] Synthesis failed:', err?.message);
      return {
        containsClaims: true,
        verdict: 'Insufficient evidence',
        credibility: 'none',
        confidence: 40,
        explanation: 'Narrative verification could not be completed. Please try again later.',
        isSatire: false,
      };
    }
  }
}
