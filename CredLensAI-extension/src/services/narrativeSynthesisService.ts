// src/services/narrativeSynthesisService.ts — CredLens Narrative Synthesis Architecture
//
// Primary synthesis layer. Sends full transcript to Claude 3.5 Haiku
// via OpenRouter and receives structured NarrativeSynthesis JSON.
//
// This replaces all keyword extraction, noun-chunk extraction,
// sentence ranking, claim classification, and regex-based claim detection.

import type { NarrativeSynthesis } from '../types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const HAIKU_MODEL = 'anthropic/claude-3.5-haiku';
const TIMEOUT_MS = 15000;

// ── Synthesis Prompt ───────────────────────────────────────────────────────────

function buildSynthesisPrompt(transcript: string): string {
  // Truncate to ~4000 chars to stay within Haiku context window limits
  const truncated = transcript.slice(0, 4000);

  return `You are a narrative analysis engine for a credibility verification system.

Analyze the following video transcript and extract the narrative structure.

TRANSCRIPT:
"""
${truncated}
"""

Return JSON only. No markdown. No explanation. No preamble.

{
  "narrative_summary": "A 2-3 sentence summary of the overall narrative",
  "central_claim": "The single most important factual claim made in this video",
  "supporting_claims": ["up to 4 supporting factual claims"],
  "claim_domain": "one of: health, nutrition, medicine, politics, current_events, science, technology, finance, general",
  "hedging_level": "one of: none, low, moderate, high",
  "pubmed_queries": ["3-6 word MeSH-style query", "3-6 word MeSH-style query", "3-6 word MeSH-style query"]
}

Rules:
1. Use the complete transcript to understand the full narrative arc.
2. Produce exactly one narrative_summary.
3. Identify exactly one central_claim — the core factual assertion.
4. Identify up to 4 supporting_claims that reinforce or extend the central claim.
5. Determine the most appropriate claim_domain.
6. Detect hedging_level: "none" if claims are stated as absolute fact, "high" if heavily qualified with "may", "might", "some studies suggest", etc.
7. Do NOT extract keywords. Do NOT extract noun chunks. Do NOT rank sentences.
8. Focus on factual claims that can be verified against evidence, not opinions or commands.
9. For pubmed_queries: generate 2-4 short MeSH-style search queries (3-6 words each, no connective words like "and", "the", "can", "does"). Each query should target one testable aspect of the central claim. Example for "creatine damages kidneys": ["creatine supplementation renal safety", "creatine kidney function healthy adults", "creatine nephrotoxicity risk"].`;
}

// ── Retrieval Query Generation ─────────────────────────────────────────────────

/**
 * Build retrieval queries from the synthesis output.
 * Queries are derived from central_claim + supporting_claims,
 * NOT from transcript words.
 */
export function buildRetrievalQueries(synthesis: NarrativeSynthesis): string[] {
  const queries: string[] = [];

  // Use Haiku-generated PubMed queries as primary retrieval queries
  if (synthesis.pubmed_queries && synthesis.pubmed_queries.length > 0) {
    queries.push(...synthesis.pubmed_queries.slice(0, 4));
  } else {
    // Fallback: use central_claim and supporting_claims
    if (synthesis.central_claim) {
      queries.push(synthesis.central_claim);
    }
    for (const claim of synthesis.supporting_claims.slice(0, 3)) {
      if (claim && claim.trim().length > 10) {
        queries.push(claim);
      }
    }
  }

  if (queries.length === 0 && synthesis.narrative_summary) {
    queries.push(synthesis.narrative_summary);
  }

  console.log(`[NarrativeSynthesis] Built ${queries.length} retrieval queries from synthesis.`);
  queries.forEach((q, i) => console.log(`  [Query ${i + 1}] ${q}`));

  return queries;
}

// ── Main Synthesis Function ────────────────────────────────────────────────────

/**
 * Send the full stabilized transcript to Claude 3.5 Haiku via OpenRouter
 * and receive a structured NarrativeSynthesis.
 */
export async function synthesizeNarrative(
  transcript: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<NarrativeSynthesis> {
  if (!apiKey) {
    throw new Error('OpenRouter API key is required for Narrative Synthesis.');
  }

  const prompt = buildSynthesisPrompt(transcript);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  // Chain external signal to our controller
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeout);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    console.log('[NarrativeSynthesis] Sending transcript to Haiku...');

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://credlens.ai',
        'X-Title': 'CredLens NarrativeAI',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        messages: [
          { role: 'user', content: prompt },
        ],
        temperature: 0.1,
        max_tokens: 800,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('OpenRouter returned empty content');
    }

    // Parse JSON — handle potential markdown wrapping
    const jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const synthesis = JSON.parse(jsonStr) as NarrativeSynthesis;

    // Validate required fields
    if (!synthesis.narrative_summary || !synthesis.central_claim) {
      throw new Error('Synthesis response missing required fields');
    }

    // Normalize
    synthesis.supporting_claims = synthesis.supporting_claims || [];
    synthesis.claim_domain = synthesis.claim_domain || 'general';
    synthesis.hedging_level = synthesis.hedging_level || 'low';
    synthesis.pubmed_queries = synthesis.pubmed_queries || [];

    console.log('[NarrativeSynthesis] Synthesis complete:');
    console.log(`  Narrative: ${synthesis.narrative_summary.slice(0, 100)}...`);
    console.log(`  Central claim: ${synthesis.central_claim}`);
    console.log(`  Supporting claims: ${synthesis.supporting_claims.length}`);
    console.log(`  Domain: ${synthesis.claim_domain}`);
    console.log(`  Hedging: ${synthesis.hedging_level}`);

    return synthesis;

  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') throw err;

    console.error('[NarrativeSynthesis] Synthesis failed:', err?.message);

    // Return a fallback synthesis for robustness
    return {
      narrative_summary: transcript.slice(0, 200),
      central_claim: transcript.slice(0, 150),
      supporting_claims: [],
      claim_domain: 'general',
      hedging_level: 'low',
    };
  }
}
