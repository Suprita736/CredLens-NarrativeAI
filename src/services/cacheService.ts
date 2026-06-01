// src/services/cacheService.ts — CredLens NarrativeAI Phase 1
//
// Semantic narrative cache.
// Stores: embedding + verdict + evidence bundle.
//
// Before retrieval: generate embedding → compare against cached embeddings
// using cosine similarity → if similarity exceeds threshold, reuse cached
// verdict and evidence, skip retrieval, skip AI.
//
// Goal: 100 videos → reuse previous narrative analyses whenever possible.

import type { NarrativeAnalysis, NarrativeCacheEntry, EvidenceBundle, EmbeddingVector } from '../types';
import { cosineSimilarity } from '../utils/semanticEmbedder';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_PREFIX_VIDEO = 'credlens_narrative_';
const MAX_L1_ENTRIES = 50;
const DB_NAME = 'credlens-narrative-db';
const DB_VERSION = 1;
const STORE_NAME = 'narratives';

// Semantic similarity threshold for cache hits
const SIMILARITY_THRESHOLD = 0.85;

export class CacheService {
  // L1 Cache: In-memory
  private static l1Cache = new Map<string, NarrativeCacheEntry>();

  // ── IndexedDB helpers ──────────────────────────────────────────────────────

  private static openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  private static async getFromDB(key: string): Promise<NarrativeCacheEntry | null> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  private static async setInDB(key: string, entry: NarrativeCacheEntry): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.put(entry, key);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.warn('[CacheService] IndexedDB write failed:', err);
    }
  }

  private static async removeFromDB(key: string): Promise<void> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const request = store.delete(key);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
      });
    } catch {
      // swallow
    }
  }

  private static async getAllFromDB(): Promise<{ key: string; entry: NarrativeCacheEntry }[]> {
    try {
      const db = await this.openDB();
      return new Promise((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const results: { key: string; entry: NarrativeCacheEntry }[] = [];
        const request = store.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as any).result;
          if (cursor) {
            results.push({ key: cursor.key as string, entry: cursor.value });
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        request.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  // ── L1 management ──────────────────────────────────────────────────────────

  private static maintainL1Limit(): void {
    if (this.l1Cache.size > MAX_L1_ENTRIES) {
      const firstKey = this.l1Cache.keys().next().value;
      if (firstKey !== undefined) {
        this.l1Cache.delete(firstKey);
      }
    }
  }

  // ── Video ID lookup ────────────────────────────────────────────────────────

  /**
   * Look up cache by video ID.
   */
  static async getByVideoId(videoId: string): Promise<NarrativeAnalysis | null> {
    const key = `${CACHE_PREFIX_VIDEO}${videoId}`;
    const now = Date.now();

    // L1
    const l1 = this.l1Cache.get(key);
    if (l1 && now - l1.timestamp < CACHE_TTL_MS) {
      console.log(`[CacheService] L1 Hit: ${videoId}`);
      return l1.analysis;
    }

    // L2 (chrome.storage)
    try {
      const result = await chrome.storage.local.get([key]);
      const entry = result[key] as NarrativeCacheEntry | undefined;
      if (entry && now - entry.timestamp < CACHE_TTL_MS) {
        console.log(`[CacheService] L2 Hit: ${videoId}`);
        this.l1Cache.set(key, entry);
        this.maintainL1Limit();
        return entry.analysis;
      }
    } catch {
      // swallow
    }

    // L3 (IndexedDB)
    const l3 = await this.getFromDB(key);
    if (l3 && now - l3.timestamp < CACHE_TTL_MS) {
      console.log(`[CacheService] L3 Hit: ${videoId}`);
      this.l1Cache.set(key, l3);
      this.maintainL1Limit();
      return l3.analysis;
    }

    return null;
  }

  // ── Semantic similarity lookup ─────────────────────────────────────────────

  /**
   * Search for a semantically similar narrative in the cache.
   * Compares the embedding against all cached embeddings using cosine similarity.
   *
   * Returns the cached analysis if similarity > SIMILARITY_THRESHOLD.
   * This enables reuse across different videos with similar narratives.
   */
  static async findSimilarNarrative(
    embedding: EmbeddingVector
  ): Promise<NarrativeAnalysis | null> {
    // Check if embedding is valid (not a zero vector)
    if (embedding.every(v => v === 0)) return null;

    const now = Date.now();
    let bestMatch: NarrativeCacheEntry | null = null;
    let bestSimilarity = 0;

    // Search L1 first (fast)
    for (const [, entry] of this.l1Cache) {
      if (now - entry.timestamp > CACHE_TTL_MS) continue;
      if (!entry.embedding || entry.embedding.length === 0) continue;

      const sim = cosineSimilarity(embedding, entry.embedding);
      if (sim > bestSimilarity) {
        bestSimilarity = sim;
        bestMatch = entry;
      }
    }

    // If L1 didn't find a good match, search L3 (IndexedDB)
    if (bestSimilarity < SIMILARITY_THRESHOLD) {
      const allEntries = await this.getAllFromDB();
      for (const { entry } of allEntries) {
        if (now - entry.timestamp > CACHE_TTL_MS) continue;
        if (!entry.embedding || entry.embedding.length === 0) continue;

        const sim = cosineSimilarity(embedding, entry.embedding);
        if (sim > bestSimilarity) {
          bestSimilarity = sim;
          bestMatch = entry;
        }
      }
    }

    if (bestMatch && bestSimilarity >= SIMILARITY_THRESHOLD) {
      console.log(
        `[CacheService] Semantic cache hit! Similarity: ${bestSimilarity.toFixed(3)} >= ${SIMILARITY_THRESHOLD}`
      );
      return bestMatch.analysis;
    }

    return null;
  }

  // ── Store ──────────────────────────────────────────────────────────────────

  /**
   * Cache a narrative analysis result with its embedding and evidence.
   */
  static async set(
    videoId: string,
    embedding: EmbeddingVector,
    analysis: NarrativeAnalysis,
    evidence: EvidenceBundle
  ): Promise<void> {
    const key = `${CACHE_PREFIX_VIDEO}${videoId}`;
    const entry: NarrativeCacheEntry = {
      embedding,
      analysis,
      evidence,
      timestamp: Date.now(),
    };

    // L1
    this.l1Cache.set(key, entry);
    this.maintainL1Limit();

    // L2
    try {
      await chrome.storage.local.set({ [key]: entry });
    } catch (err) {
      console.warn('[CacheService] L2 write failed:', err);
    }

    // L3
    await this.setInDB(key, entry);

    console.log(`[CacheService] Cached narrative for ${videoId}`);
  }

  // ── Prune ──────────────────────────────────────────────────────────────────

  /**
   * Remove expired entries from all tiers.
   */
  static async prune(): Promise<void> {
    const now = Date.now();
    console.log('[CacheService] Starting cache prune...');

    // L1
    for (const [key, entry] of this.l1Cache.entries()) {
      if (now - entry.timestamp > CACHE_TTL_MS) {
        this.l1Cache.delete(key);
      }
    }

    // L2
    try {
      const all = await chrome.storage.local.get(null);
      const toDelete: string[] = [];
      for (const key of Object.keys(all)) {
        if (key.startsWith(CACHE_PREFIX_VIDEO)) {
          const entry = all[key] as NarrativeCacheEntry | undefined;
          if (!entry || !entry.timestamp || now - entry.timestamp > CACHE_TTL_MS) {
            toDelete.push(key);
          }
        }
      }
      if (toDelete.length > 0) {
        await chrome.storage.local.remove(toDelete);
        console.log(`[CacheService] L2 pruned ${toDelete.length} entries.`);
      }
    } catch {
      // swallow
    }

    // L3
    try {
      const allEntries = await this.getAllFromDB();
      for (const { key, entry } of allEntries) {
        if (now - entry.timestamp > CACHE_TTL_MS) {
          await this.removeFromDB(key);
        }
      }
    } catch {
      // swallow
    }
  }
}
