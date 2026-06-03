// src/types/index.ts — CredLens NarrativeAI Phase 1

// ── Narrative-level types ──────────────────────────────────────────────────────

export type CredibilityLevel = 'low' | 'medium' | 'high' | 'none';

/** A narrative verdict generated from evidence analysis. */
export type NarrativeVerdict =
  | 'Supported by evidence'
  | 'Evidence is mixed'
  | 'Not supported by evidence'
  | 'Exaggerated claim'
  | 'Insufficient evidence'
  | 'Satirical / Entertainment'
  | 'No verifiable claims detected';

/** Semantic embedding vector (Float32). */
export type EmbeddingVector = number[];

/** A single theme extracted from a narrative. */
export interface NarrativeTheme {
  summary: string;
  embedding: EmbeddingVector;
}

/**
 * Full narrative representation computed from a transcript.
 * Replaces the old per-claim extraction model.
 */
export interface NarrativeRepresentation {
  /** Original transcript text. */
  transcript: string;
  /** Semantic embedding of the entire narrative. */
  embedding: EmbeddingVector;
  /** Key themes within the narrative. */
  themes: NarrativeTheme[];
  /** Generated retrieval queries derived from narrative claims. */
  retrievalQueries: string[];
  /** Claims extracted from the narrative. */
  claimsIdentified: string[];
  /** Timestamp of creation. */
  timestamp: number;
}

// ── Evidence types (kept from Phase 5) ─────────────────────────────────────────

export interface FactCheckReview {
  publisher: string;
  url: string;
  title: string;
  verdict: string;
  date?: string;
}

export interface FactCheckResult {
  verified: boolean;
  verdict: string;
  source: string;
  explanation: string;
  url: string;
  confidence: number;
}

export interface ResearchArticle {
  title: string;
  journal: string;
  authors: string;
  date: string;
  url: string;
  id: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  date: string;
}

export interface EvidenceBundle {
  factCheck?: FactCheckResult | null;
  healthResearch?: ResearchArticle[];
  newsArticles?: NewsArticle[];
}

// ── Narrative Analysis (replaces ClaimAnalysis) ────────────────────────────────

export interface NarrativeAnalysis {
  /** Whether the transcript contains verifiable claims. */
  containsClaims: boolean;
  /** The overall narrative verdict. */
  verdict: NarrativeVerdict;
  /** Credibility level. */
  credibility: CredibilityLevel;
  /** Confidence score 0–100. */
  confidence: number;
  /** Human-readable narrative summary / explanation. */
  explanation: string;
  /** Additional context for the user. */
  context?: string;
  /** The retrieval queries used. */
  retrievalQueries?: string[];
  /** The claims identified. */
  claimsIdentified?: string[];
  /** Whether this is satirical or entertainment content. */
  isSatire: boolean;

  // Rich evidence sub-blocks
  factCheck?: FactCheckResult | null;
  healthResearch?: { status: string; summary: string; sources: ResearchArticle[] } | null;
  newsVerification?: { status: string; summary: string; sources: NewsArticle[] } | null;

  // Confidence breakdown
  scientificSupport?: 'Strong' | 'Moderate' | 'Weak' | 'None' | 'N/A';
  manipulationRisk?: 'High' | 'Moderate' | 'Low';
  evidenceStrength?: 'Strong' | 'Moderate' | 'Weak';

  // Source attribution
  sourceName?: string;
  sourceUrl?: string;
}

// ── Semantic Cache Entry ───────────────────────────────────────────────────────

export interface NarrativeCacheEntry {
  analysis: NarrativeAnalysis;
  evidence: EvidenceBundle;
  timestamp: number;
  transcriptLength: number;
  analyzedAtProgress: number;
}

// ── Extension Messaging ────────────────────────────────────────────────────────

export interface VideoState {
  videoId: string;
  viewTime: number;
  processed: boolean;
  status?: 'loading' | 'completed' | 'error';
  analysis?: NarrativeAnalysis;
}

export interface BackgroundMessage {
  action: 'VERIFY_TRANSCRIPT' | 'CANCEL_VERIFICATION';
  videoId?: string;
  transcript?: string;
  transcriptLength?: number;
  currentProgress?: number;
}

export interface BackgroundResponse {
  status: 'loading' | 'completed' | 'error';
  videoId: string;
  analysis?: NarrativeAnalysis;
  error?: string;
}

// ── Extension Settings ─────────────────────────────────────────────────────────

export interface ExtensionSettings {
  geminiApiKey?: string;
  openRouterApiKey?: string;
}

// ── AI Provider (fallback only) ────────────────────────────────────────────────

export interface AIProvider {
  analyzeNarrative(
    narrative: string,
    evidence?: EvidenceBundle
  ): Promise<NarrativeAnalysis>;
}
