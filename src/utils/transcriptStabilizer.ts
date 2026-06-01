// src/utils/transcriptStabilizer.ts — CredLens NarrativeAI Phase 1
//
// Transcript stabilization layer.
//
// Problem: YouTube captions arrive progressively:
//   "soy"
//   "soy milk"
//   "soy milk increases"
//   "soy milk increases estrogen"
//
// Without stabilization, each intermediate fragment triggers processing.
// This module ensures we only process the final, stable transcript.

/**
 * TranscriptStabilizer accumulates caption segments and determines
 * when the transcript has stabilized (stopped changing) before
 * releasing it for narrative analysis.
 */
export class TranscriptStabilizer {
  /** Accumulated raw segments. */
  private segments: string[] = [];
  /** The last stable snapshot of the transcript. */
  private lastSnapshot: string = '';
  /** Timer for stability detection. */
  private stabilityTimer: ReturnType<typeof setTimeout> | null = null;
  /** Number of consecutive unchanged snapshots. */
  private unchangedCount: number = 0;
  /** Minimum words needed before considering stabilization. */
  private readonly minWords: number;
  /** Milliseconds to wait after last change before declaring stable. */
  private readonly stabilityDelayMs: number;
  /** Set of deduplicated segment hashes. */
  private seenSegments: Set<string> = new Set();

  constructor(options?: { minWords?: number; stabilityDelayMs?: number }) {
    this.minWords = options?.minWords ?? 40;
    this.stabilityDelayMs = options?.stabilityDelayMs ?? 2000;
  }

  /**
   * Feed a new caption segment into the stabilizer.
   * Returns `null` while accumulating, or the stabilized transcript
   * when stability is detected.
   */
  addSegment(segment: string): void {
    const trimmed = segment.trim();
    if (!trimmed) return;

    // Deduplicate incoming segments
    const normalised = trimmed.toLowerCase().replace(/\s+/g, ' ');
    if (this.seenSegments.has(normalised)) return;
    this.seenSegments.add(normalised);

    this.segments.push(trimmed);
  }

  /**
   * Get the current accumulated transcript (all segments joined).
   */
  getCurrentTranscript(): string {
    return this.segments.join(' ').replace(/\s+/g, ' ').trim();
  }

  /**
   * Get the word count of the current accumulated transcript.
   */
  getWordCount(): number {
    return this.getCurrentTranscript().split(/\s+/).filter(Boolean).length;
  }

  /**
   * Check if the transcript has reached minimum word threshold.
   */
  hasMinimumContent(): boolean {
    return this.getWordCount() >= this.minWords;
  }

  /**
   * Start stability detection. Calls `onStable` when the transcript
   * hasn't changed for `stabilityDelayMs`.
   */
  waitForStability(onStable: (transcript: string) => void): void {
    if (this.stabilityTimer) {
      clearTimeout(this.stabilityTimer);
    }

    const currentSnapshot = this.getCurrentTranscript();

    if (currentSnapshot === this.lastSnapshot) {
      this.unchangedCount++;
    } else {
      this.unchangedCount = 0;
      this.lastSnapshot = currentSnapshot;
    }

    // Only start the timer if we have minimum content
    if (!this.hasMinimumContent()) return;

    this.stabilityTimer = setTimeout(() => {
      const finalTranscript = this.getCurrentTranscript();
      if (finalTranscript && this.hasMinimumContent()) {
        console.log(
          `[TranscriptStabilizer] Transcript stabilized: ${this.getWordCount()} words.`
        );
        onStable(finalTranscript);
      }
    }, this.stabilityDelayMs);
  }

  /**
   * Clean the accumulated transcript for processing.
   * Removes bracket tags, collapses whitespace, deduplicates sentences.
   */
  getCleanTranscript(): string {
    let text = this.getCurrentTranscript();

    // Remove bracket tags ([music], [applause], etc.)
    text = text.replace(/\[.*?\]/g, '');
    // Remove subtitle arrows
    text = text.replace(/>>/g, '');
    // Collapse whitespace
    text = text.replace(/\s+/g, ' ').trim();

    // Deduplicate consecutive repeated words
    text = text.replace(/\b(\w+)( \1\b)+/gi, '$1');

    // Sentence-level dedup
    const sentences = text.split(/(?<=[.!?])\s+/);
    const seen = new Set<string>();
    const unique: string[] = [];

    for (const sentence of sentences) {
      const norm = sentence.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
      if (norm && !seen.has(norm)) {
        seen.add(norm);
        unique.push(sentence.trim());
      }
    }

    return unique.join(' ').trim();
  }

  /**
   * Reset all state for a new video.
   */
  reset(): void {
    this.segments = [];
    this.lastSnapshot = '';
    this.seenSegments.clear();
    this.unchangedCount = 0;
    if (this.stabilityTimer) {
      clearTimeout(this.stabilityTimer);
      this.stabilityTimer = null;
    }
  }
}
