// src/utils/narrativeEngine.ts — CredLens NarrativeAI Phase 1
//
// Core narrative analysis engine.
// Transforms a transcript into a NarrativeRepresentation.
// Embeddings have been disabled for runtime stability.

import type { NarrativeRepresentation, NarrativeTheme, EmbeddingVector } from '../types';

// ── Sentence splitting ─────────────────────────────────────────────────────────

/**
 * Split text into semantic sentences for theme extraction.
 */
function splitIntoSentences(text: string): string[] {
  const normalised = text.replace(/\s+/g, ' ').trim();
  // Split on sentence-ending punctuation followed by space + capital or end
  const raw = normalised.split(/(?<=[.!?])\s+(?=[A-Z"'])/);
  return raw
    .map(s => s.trim())
    .filter(s => s.length >= 10);
}

/**
 * Detect if transcript is pure noise / non-factual content.
 * Uses minimal heuristics only for obvious noise — no keyword classification.
 */
function isObviousNoise(text: string): boolean {
  const lower = text.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  // Too short to contain any narrative
  if (words.length < 10) return true;

  // Music bracket tags dominate
  const musicTags = ['[music]', '[musique]', '[musik]', '[applause]', '[cheering]', '[laughter]'];
  const musicCount = musicTags.filter(t => lower.includes(t)).length;
  if (musicCount >= 2) return true;

  // Extremely repetitive content
  const uniqueRatio = new Set(words).size / words.length;
  if (uniqueRatio < 0.05) return true;

  return false;
}

// ── Retrieval Query Generation ─────────────────────────────────────────────────

/**
 * Generate retrieval queries and extract claims from the narrative.
 */
function generateRetrievalQueries(transcript: string): { summary: string, queries: string[], claims: string[] } {
  const fillerPatterns = [
    /\b(?:subscribe|follow|like|comment|share|bell|link in bio|watch till|hit the bell|smash)\b/ig,
    /\b(?:hey guys|what's up|welcome back|hi everyone|hello friends|in this video)\b/ig,
    /\b(?:you're|literally|number|watch this video|understand|probably|omg|wow|amazing|incredible|crazy|insane)\b/ig
  ];

  let summary = transcript;
  fillerPatterns.forEach(p => {
    summary = summary.replace(p, '');
  });
  summary = summary.replace(/\s+/g, ' ').trim();

  // Split into declarative factual statements (claims)
  const rawSentences = splitIntoSentences(summary);
  
  // Strict filtering for valid claims (subject, verb, factual assertion)
  const invalidStarters = /^(that's|this is|here's|number|watch|click|look|so|and|but|because|well|now)\b/i;
  const commandPatterns = /^(watch|subscribe|click|follow|check out|let me)\b/i;
  
  const validClaims = rawSentences.filter(s => {
    const words = s.split(/\s+/);
    if (words.length < 4) return false; // Reject "That's right", "Modern studies"
    if (invalidStarters.test(s)) return false; // Reject "Number two", "Here's why"
    if (commandPatterns.test(s)) return false; // Reject "Watch this video"
    return true;
  });

  const claims = validClaims.slice(0, 3); // Take up to 3 most prominent sentences as claims

  const stopWords = new Set([
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "for", "if", "in", "into", "is",
    "it", "no", "not", "of", "on", "or", "such", "that", "the", "their", "then", "there", "these",
    "they", "this", "to", "was", "will", "with", "i", "you", "we", "my", "your", "our", "he", "she",
    "them", "what", "which", "who", "whom", "how", "why", "when", "where", "can", "could",
    "should", "would", "may", "might", "must", "do", "does", "did", "have", "has", "had", "very",
    "really", "just", "so", "too", "about", "also", "because", "been", "out", "some", "than", "up",
    "use", "used", "using", "from", "its", "make", "many", "more", "most", "much", "other", "over",
    "those", "through", "under", "well", "were", "while", "only", "claims", "creator"
  ]);

  const queries = claims.map(claim => {
    const cleanText = claim.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const words = cleanText.split(' ').filter(w => w.length > 2 && !stopWords.has(w));
    const uniqueConcepts = Array.from(new Set(words));
    return uniqueConcepts.join(' ') + ' evidence';
  });

  let readableSummary = "The creator claims that:\n" + claims.map(c => `* ${c}`).join('\n');
  if (claims.length === 0) {
    readableSummary = "No verifiable claims detected.";
  }

  console.log(`[NarrativeSummary]\n${readableSummary}`);
  console.log(`[ClaimsIdentified]\n${claims.join('\n')}`);
  queries.forEach((q, i) => console.log(`[RetrievalQuery] Generated Query ${i + 1}: ${q}`));

  return { summary: readableSummary, queries, claims };
}

// ── Main Narrative Construction ────────────────────────────────────────────────

/**
 * Build a NarrativeRepresentation from a transcript.
 */
export async function buildNarrative(transcript: string): Promise<NarrativeRepresentation> {
  const sentences = splitIntoSentences(transcript);

  const fullEmbedding: EmbeddingVector = [];

  const themes: NarrativeTheme[] = [];
  const themeCandiates = sentences.slice(0, 5);
  for (const sentence of themeCandiates) {
    themes.push({
      summary: sentence,
      embedding: [],
    });
  }

  const { queries, claims } = generateRetrievalQueries(transcript);

  return {
    transcript,
    embedding: fullEmbedding,
    themes,
    retrievalQueries: queries,
    claimsIdentified: claims,
    timestamp: Date.now(),
  };
}

/**
 * Determine if a transcript has verifiable content using semantic analysis.
 * Replaces keyword-based claim filtering.
 *
 * Returns true if the narrative is worth verifying against evidence.
 */
export function hasVerifiableContent(transcript: string): boolean {
  if (isObviousNoise(transcript)) return false;

  const lower = transcript.toLowerCase();
  const words = lower.split(/\s+/).filter(Boolean);

  // Must have minimum substance
  if (words.length < 15) return false;

  // Check if at least one sentence has substantial content
  // (not all filler / greetings / CTAs)
  const sentences = splitIntoSentences(transcript);
  const fillerPatterns = [
    /\b(?:subscribe|follow|like|comment|share|bell|link in bio|watch till|hit the bell|smash)\b/i,
    /\b(?:hey guys|what's up|welcome back|hi everyone|hello friends)\b/i,
    /^\s*(?:omg|wow|amazing|incredible|crazy|insane)\b/i,
  ];

  const substantiveSentences = sentences.filter(s =>
    !fillerPatterns.some(p => p.test(s))
  );

  return substantiveSentences.length >= 1 && words.length >= 15;
}

/**
 * Check if a zero-vector was returned (model failed to load).
 */
export function isZeroVector(vec: EmbeddingVector): boolean {
  return vec.every(v => v === 0);
}
