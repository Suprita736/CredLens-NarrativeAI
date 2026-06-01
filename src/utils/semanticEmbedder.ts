// src/utils/semanticEmbedder.ts — CredLens NarrativeAI Phase 1
//
// Semantic embedding layer using @xenova/transformers with all-MiniLM-L6-v2.
// Replaces all keyword-based classification with semantic understanding.
//
// In a Chrome extension MV3 background service worker, we cannot use WebGPU
// or WASM directly; the model runs with the ONNX WASM backend bundled by
// Xenova/transformers. For cold starts, the model is downloaded once and
// cached in IndexedDB by the library.

import type { EmbeddingVector } from '../types';

// ── Lazy pipeline singleton ────────────────────────────────────────────────────

let pipelineInstance: any = null;
let pipelineLoading: Promise<any> | null = null;

/**
 * Lazily initialise the feature-extraction pipeline.
 * The model (~22 MB quantized) is downloaded once and cached.
 */
async function getPipeline(): Promise<any> {
  if (pipelineInstance) return pipelineInstance;
  if (pipelineLoading) return pipelineLoading;

  pipelineLoading = (async () => {
    try {
      // Dynamic import so tree-shaking doesn't pull the full library
      // until actually needed.
      const { pipeline } = await import('@xenova/transformers');
      console.log('[SemanticEmbedder] Loading all-MiniLM-L6-v2 model...');
      pipelineInstance = await pipeline(
        'feature-extraction',
        'Xenova/all-MiniLM-L6-v2',
        { quantized: true }
      );
      console.log('[SemanticEmbedder] Model loaded successfully.');
      return pipelineInstance;
    } catch (err) {
      console.error('[SemanticEmbedder] Failed to load model:', err);
      pipelineLoading = null;
      throw err;
    }
  })();

  return pipelineLoading;
}

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Compute the embedding vector for a text string.
 * Returns a normalised 384-dimensional Float32 vector.
 *
 * Falls back to a zero-vector if the model fails to load (extension
 * continues functioning with degraded cache matching).
 */
export async function embed(text: string): Promise<EmbeddingVector> {
  try {
    const extractor = await getPipeline();
    const output = await extractor(text, { pooling: 'mean', normalize: true });
    // output.data is a Float32Array — convert to plain number[]
    return Array.from(output.data as Float32Array);
  } catch (err) {
    console.warn('[SemanticEmbedder] Embedding failed, returning zero vector:', err);
    return new Array(384).fill(0);
  }
}

/**
 * Cosine similarity between two embedding vectors.
 * Returns a value in [-1, 1]; 1 = identical, 0 = orthogonal.
 */
export function cosineSimilarity(a: EmbeddingVector, b: EmbeddingVector): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Preload the model so that subsequent calls to `embed()` are instant.
 * Call this during extension startup / idle time.
 */
export async function preloadModel(): Promise<void> {
  try {
    await getPipeline();
  } catch {
    // swallow — non-critical
  }
}
