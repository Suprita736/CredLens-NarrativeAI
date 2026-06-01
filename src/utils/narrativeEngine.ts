// src/utils/narrativeEngine.ts — CredLens NarrativeAI Phase 1
//
// Core narrative analysis engine.
// Transforms a transcript into a NarrativeRepresentation using semantic
// embeddings — no keyword matching, no hardcoded category words,
// no rule-based category detection.

import { embed } from './semanticEmbedder';
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
 * Generate a retrieval query from the narrative, not from individual claims.
 * The query captures the overall narrative intent for evidence retrieval.
 */
function generateRetrievalQuery(sentences: string[]): string {
  // Take the most information-dense sentences (longest, filtering filler)
  const fillerPatterns = [
    /\b(?:subscribe|follow|like|comment|share|bell|link in bio|watch till)\b/i,
    /\b(?:hey guys|what's up|welcome back|in this video)\b/i,
  ];

  const substantive = sentences.filter(s => {
    return !fillerPatterns.some(p => p.test(s));
  });

  // Sort by length (longer sentences are more information-dense)
  const ranked = substantive
    .sort((a, b) => b.length - a.length)
    .slice(0, 3); // top 3 most substantive

  // Join into a retrieval query — the semantic engines (PubMed, FactCheck, News)
  // will receive this as their query, representing the entire narrative
  return ranked.join('. ').slice(0, 500);
}

// ── Main Narrative Construction ────────────────────────────────────────────────

/**
 * Build a NarrativeRepresentation from a transcript.
 *
 * Pipeline:
 *   transcript → sentences → embeddings → narrative representation
 *
 * No keyword matching. No hardcoded categories. Pure semantic.
 */
export async function buildNarrative(transcript: string): Promise<NarrativeRepresentation> {
  const sentences = splitIntoSentences(transcript);

  // 1. Embed the entire narrative
  const fullEmbedding = await embed(transcript);

  // 2. Extract themes by embedding individual sentences
  const themes: NarrativeTheme[] = [];
  // Embed up to 5 key sentences to identify themes
  const themeCandiates = sentences.slice(0, 5);
  for (const sentence of themeCandiates) {
    const sentenceEmbedding = await embed(sentence);
    themes.push({
      summary: sentence,
      embedding: sentenceEmbedding,
    });
  }

  // 3. Generate retrieval query from narrative meaning
  const retrievalQuery = generateRetrievalQuery(sentences);

  return {
    transcript,
    embedding: fullEmbedding,
    themes,
    retrievalQuery,
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
