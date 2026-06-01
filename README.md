# CredLens AI — Phase 5 Architecture

> Real-time fact verification for YouTube Shorts.
> Retrieval-first. LLM-last-resort. Resilient when APIs are down.

---

## What It Does

CredLens reads YouTube Shorts captions in real-time and runs them through a multi-stage local + retrieval pipeline to detect and evaluate verifiable factual claims — surfacing the result as an unobtrusive overlay on the video.

---

## Architecture Diagram

```
YouTube Short Caption Stream
        │
        ▼
┌─────────────────────────┐
│  Watch-Time Gate (3 s)  │  Swipe lock — ignore first 3 s to prevent
│  + Caption Debounce     │  false triggers on swipe navigation
└────────────┬────────────┘
             │ transcript (≥ 40 words)
             ▼
┌─────────────────────────┐
│  Transcript Pre-Filter  │  Rejects: music, filler, emoji spam, repetition
│  (transcriptFilter.ts)  │  Zero API cost
└────────────┬────────────┘
             │ pass
             ▼
┌─────────────────────────┐
│  Content Filter         │  Scans for factual-claim signal patterns
│  (claimFilter.ts)       │  e.g. "research shows", "% of", "banned"
└────────────┬────────────┘
             │ has claim signals
             ▼
┌─────────────────────────┐
│  Claim Extractor        │  Extracts only factual-looking sentences
│  (claimExtractor.ts)    │  Reduces token payload by 70–90%
└────────────┬────────────┘
             │ candidate sentences
             ▼
┌─────────────────────────┐  ← NEW (Phase 5)
│  Verifiability Filter   │  Rejects: "I'm a dietitian", "Follow me",
│  (verifiabilityFilter)  │  "Watch till the end", "This is my experience"
└────────────┬────────────┘  Allows: "Protein shakes damage kidneys"
             │ best verifiable claim
             ▼
┌─────────────────────────┐
│  Claim Hash Cache       │  SHA-256(claim) → IndexedDB + chrome.storage
│  (cacheService.ts)      │  ← Checked BEFORE retrieval (Phase 5 fix)
└────────────┬────────────┘
     hit ◄───┤ miss
     │       ▼
     │  ┌─────────────────────────┐
     │  │  Local Classifier       │  Keyword-based: health / science /
     │  │  (claimClassifier.ts)   │  politics / news / finance / other
     │  └────────────┬────────────┘
     │               │ category
     │               ▼
     │  ┌─────────────────────────┐
     │  │  Smart Retrieval        │  Category-aware — no blanket queries
     │  │  (retrievalEngine.ts)   │
     │  │                         │  health    → PubMed only
     │  │                         │  science   → PubMed + FactCheck
     │  │                         │  politics  → FactCheck + News
     │  │                         │  news      → FactCheck + News
     │  │                         │  finance   → FactCheck + News
     │  │                         │  general   → FactCheck only
     │  └────────────┬────────────┘
     │               │ evidence bundle
     │               ▼
     │  ┌─────────────────────────┐
     │  │  Confidence Engine      │  Relevance-based scoring:
     │  │  computeRetrieval()     │  • Source authority
     │  │                         │  • Source relevance to category
     │  │                         │  • Source agreement
     │  │                         │  • Claim specificity (numeric bonus)
     │  │                         │  News NEVER boosts health claims
     │  └────────────┬────────────┘
     │               │ retrieval confidence 0–100
     │               ▼
     │  ┌─────────────────────────────────────────┐
     │  │           Decision Engine               │
     │  │                                         │
     │  │  confidence ≥ 60 or hasEvidence         │
     │  │    → Local Synthesis (no LLM)           │
     │  │                                         │
     │  │  confidence < 60 AND no evidence        │
     │  │    → Gemini synthesis (if key present)  │  optional
     │  │    → Local synthesis fallback           │  always works
     │  └────────────┬────────────────────────────┘
     │               │ ClaimAnalysis
     │               ▼
     │  ┌─────────────────────────┐
     │  │  ConfidenceScorer       │  Final multi-factor scoring:
     │  │  .compute()             │  credibility / evidence / manip. risk
     │  └────────────┬────────────┘
     │               │ final confidence
     │               ▼
     │  ┌─────────────────────────┐
     │  │  OpenRouter Escalation  │  LAST RESORT — only if:
     │  │  (escalationManager)    │  1. confidence < 60 AND
     │  │                         │  2. openRouterApiKey configured
     │  └────────────┬────────────┘  Otherwise: silently skipped
     │               │
     └──────►  Cache Result (videoId + claimHash) → Respond to UI
```

---

## Processing Pipeline

| Stage | File | API Cost | Required |
|-------|------|----------|----------|
| Watch-time gate | `content/index.tsx` | Free | Yes |
| Transcript pre-filter | `transcriptFilter.ts` | Free | Yes |
| Content filter | `claimFilter.ts` | Free | Yes |
| Claim extraction | `claimExtractor.ts` | Free | Yes |
| Verifiability filter | `verifiabilityFilter.ts` | Free | Yes |
| Claim hash cache | `cacheService.ts` | Free | Yes |
| Local classification | `claimClassifier.ts` | Free | Yes |
| FactCheck Tools | `factCheckService.ts` | Google API key | Conditional |
| PubMed search | `healthService.ts` | Free (public) | Conditional |
| Google News RSS | `newsService.ts` | Free (RSS) | Conditional |
| Gemini synthesis | `geminiService.ts` | Gemini key | **Optional** |
| OpenRouter | `openRouterService.ts` | OpenRouter key | **Optional** |

---

## Cache Strategy

CredLens uses a 3-tier cache with 24-hour TTL:

```
L1: In-memory Map         (instant, lost on worker sleep)
L2: chrome.storage.local  (persistent, 5 MB limit)
L3: IndexedDB             (persistent, large capacity)
```

**Two cache keys per result:**
- `credlens_cache_{videoId}` — per-video result
- `credlens_claim_cache_{SHA256(claim)}` — cross-video deduplication

If the same claim appears in different videos, the second video returns instantly from cache with **zero API calls**.

**Cache is checked in this order:**
1. Video ID cache — before any processing
2. Claim hash cache — after verifiability filter, before retrieval

---

## Retrieval Routing

| Category | PubMed | FactCheck | Google News |
|----------|--------|-----------|-------------|
| health | ✅ | ❌ | ❌ |
| science | ✅ | ✅ | ❌ |
| politics | ❌ | ✅ | ✅ |
| news | ❌ | ✅ | ✅ |
| finance | ❌ | ✅ | ✅ |
| technology | ❌ | ✅ | ❌ |
| general / other | ❌ | ✅ | ❌ |

**News results never contribute confidence for health or science claims.**

---

## Confidence Scoring

### Retrieval Confidence (`computeRetrieval`)

Computed BEFORE any LLM call. Determines whether LLM is needed at all.

| Source | Max Points | Condition |
|--------|-----------|-----------|
| FactCheck (Jaccard-scaled) | 45 | Category ≠ health |
| PubMed papers (×15 each, max 3) | 45 | health or science only |
| Unique news sources (×10, max 3) | 30 | politics / news / finance only |
| Numeric claim specificity | +5 | Contains %, mg, billion, etc. |
| Cross-source agreement | +8 | ≥ 2 source types returned |

**Threshold: ≥ 60 → local synthesis (no LLM). < 60 → optional LLM escalation.**

### Final Confidence (`compute`)

Post-synthesis scoring for UI display metrics:

- **Scientific Support**: Strong / Moderate / Weak / None / N/A
- **Evidence Strength**: Strong / Moderate / Weak
- **Manipulation Risk**: Low / Moderate / High
- **Confidence %**: Clamped 30–95

---

## LLM Escalation Logic

```
if retrievalConfidence >= 60 OR hasEvidence:
    → Local synthesis (free, instant)

elif retrievalConfidence < 60 AND no evidence:
    if geminiApiKey configured:
        → Try Gemini synthesis
        if Gemini fails:
            → Local synthesis fallback
    else:
        → Local synthesis fallback

    if finalConfidence < 60 AND openRouterApiKey configured:
        → Try OpenRouter as last resort
```

**The extension always produces a result.** No API key is ever required.

---

## API Usage Policy

| Scenario | APIs Called |
|----------|------------|
| Cache hit (video ID) | **None** |
| Cache hit (claim hash) | **None** |
| No claim signals | **None** |
| Non-verifiable claim filtered | **None** |
| Health claim, high retrieval confidence | PubMed only |
| Science claim, high retrieval confidence | PubMed + FactCheck |
| Politics/news claim, high retrieval confidence | FactCheck + News RSS |
| Low confidence, Gemini configured | + Gemini synthesis |
| Low confidence, OpenRouter configured | + OpenRouter (last resort) |

---

## Setup

### Required
Nothing. The extension functions in retrieval-only mode.

### Optional (improves synthesis quality)
1. **Gemini API Key** — enables natural language synthesis for difficult claims
2. **OpenRouter API Key** — last-resort LLM for very low confidence cases

Both keys are stored in `chrome.storage.local`. Configure via the extension popup.

---

## Cost Optimization

- **~70–90% token reduction** via local claim extraction before any LLM call
- **Cross-video cache deduplication** means repeated claims cost nothing after first analysis
- **Smart retrieval routing** — never queries all 3 sources; only the relevant ones
- **Watch-time gate** prevents analysis of videos the user immediately swipes past
- **Verifiability filter** blocks CTAs and opinions from ever reaching retrieval APIs

---

## Architecture Files

```
src/
├── background/
│   ├── index.ts          ← Pipeline orchestrator
│   └── queueManager.ts   ← AbortController-based cancellation
├── content/
│   └── index.tsx         ← Caption observer + Shadow DOM overlay
├── components/
│   └── CredibilityOverlay.tsx
├── services/
│   ├── cacheService.ts       ← 3-tier cache (L1/L2/L3)
│   ├── factCheckService.ts   ← Google Fact Check Tools API
│   ├── healthService.ts      ← PubMed / NIH search
│   ├── newsService.ts        ← Google News RSS
│   ├── openRouterService.ts  ← OpenRouter (last resort)
│   ├── geminiService.ts      ← Gemini synthesis (optional)
│   └── retrievalEngine.ts    ← Smart category-aware routing
├── utils/
│   ├── captionExtractor.ts     ← YouTube caption DOM observer
│   ├── transcriptFilter.ts     ← Pre-filter (music, filler, emoji)
│   ├── claimFilter.ts          ← Claim signal detection
│   ├── claimExtractor.ts       ← Sentence-level claim extraction
│   ├── verifiabilityFilter.ts  ← Rejects CTAs/opinions (Phase 5)
│   ├── claimClassifier.ts      ← Local keyword classifier
│   ├── claimRouter.ts          ← Category → source routing
│   ├── confidenceScorer.ts     ← Retrieval + final confidence scoring
│   ├── escalationManager.ts    ← Optional LLM last-resort gating
│   └── retryUtils.ts           ← Shared retry-with-delay utility
└── types/
    └── index.ts
```
