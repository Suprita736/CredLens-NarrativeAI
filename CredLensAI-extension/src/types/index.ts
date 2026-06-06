// src/types/index.ts — CredLens NarrativeAI — Narrative Synthesis Architecture
//
// All types for the Narrative Synthesis pipeline.
// Dead types removed: NarrativeRepresentation, NarrativeTheme, EmbeddingVector, AIProvider.

// ── Narrative Synthesis (LLM output) ───────────────────────────────────────────

/** Output from the Haiku Narrative Synthesis step. */
export interface NarrativeSynthesis {
  narrative_summary: string;
  central_claim: string;
  supporting_claims: string[];
  claim_domain: string;
  hedging_level: 'none' | 'low' | 'moderate' | 'high';
}

// ── Verdict types ──────────────────────────────────────────────────────────────

export type CredibilityLevel = 'low' | 'medium' | 'high' | 'none';

export type NarrativeVerdict =
  | 'Supported'
  | 'Exaggerated'
  | 'Misleading'
  | 'Insufficient Evidence';

// ── Evidence types ─────────────────────────────────────────────────────────────

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
  abstract?: string;
}

export interface NewsArticle {
  title: string;
  source: string;
  url: string;
  date: string;
}

export interface EvidenceBundle {
  factCheckStatus?: 'available' | 'unavailable';
  factCheck?: FactCheckResult | null;
  healthResearch?: ResearchArticle[];
  newsArticles?: NewsArticle[];
}

// ── Confidence Breakdown ───────────────────────────────────────────────────────

export interface ConfidenceBreakdown {
  sourceAuthority: number;       // 0-30
  evidenceRelevance: number;     // 0-30
  hedgingLevel: number;          // 0-20
  multiSourceCorroboration: number; // 0-20
  total: number;                 // 0-100
}

// ── Narrative Analysis ─────────────────────────────────────────────────────────

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
  /** The central claim from synthesis. */
  centralClaim?: string;
  /** Supporting claims from synthesis. */
  supportingClaims?: string[];
  /** The narrative summary from synthesis. */
  narrativeSummary?: string;
  /** The claim domain from synthesis. */
  claimDomain?: string;
  /** Whether this is satirical or entertainment content. */
  isSatire: boolean;

  // Rich evidence sub-blocks
  factCheck?: FactCheckResult | null;
  healthResearch?: { status: string; summary: string; sources: ResearchArticle[] } | null;
  newsVerification?: { status: string; summary: string; sources: NewsArticle[] } | null;

  // Confidence breakdown (new 4-axis)
  confidenceBreakdown?: ConfidenceBreakdown;

  // Source attribution
  sourceName?: string;
  sourceUrl?: string;

  // Supabase Archive reference
  archiveId?: string;
}

// ── Cache Entry ────────────────────────────────────────────────────────────────

export interface NarrativeCacheEntry {
  synthesis?: NarrativeSynthesis;
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
  videoTitle?: string;
  channelName?: string;
}

export interface BackgroundResponse {
  status: 'loading' | 'completed' | 'error';
  videoId: string;
  analysis?: NarrativeAnalysis;
  error?: string;
}

// ── Extension Settings ─────────────────────────────────────────────────────────

export interface ExtensionSettings {
  geminiApiKey?: string;         // DEPRECATED — kept for future fallback
  openRouterApiKey?: string;     // REQUIRED — primary synthesis layer
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
