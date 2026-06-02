# CredLens NarrativeAI

## Narrative Verification Foundation

CredLens NarrativeAI is chrome extension that verifies the overall narrative of a YouTube Short rather than isolated sentences or keyword-matched claims.

The objective is to verify the complete narrative.

Example:

Transcript: 

"Leaky gut causes eczema.
Leaky gut causes rosacea.
Ghee repairs gut lining."

Expected narrative:

"The creator argues that gut dysfunction causes skin disease and that dietary interventions such as ghee can restore gut health."

Verification operates on the narrative, not transcript fragments.

---

## Runtime Flow

YouTube Short
↓
Transcript Collector
↓
Watch Completion Gate (85%)
↓
Transcript Stabilizer
↓
Narrative Engine
↓
Video ID Cache Check
↓
Evidence Retrieval
↓
Verdict Builder
↓
Overlay

---

## Watch Completion Gate

Verification begins only when:

1. The Short finishes naturally
OR
2. The user has watched at least 85% of the Short

While the Short is actively playing, the system collects captions and stabilizes the transcript, but it does NOT generate embeddings, perform retrieval, or query any APIs (PubMed, Fact Check, News, Gemini, OpenRouter).

This prevents verification from operating on incomplete narratives.

If the user continues watching the same Short after the 85% gate and the transcript grows significantly (>15%), the cache is refreshed with a new analysis to ensure the final representation is fully complete.

---

## Cache Strategy

### Phase 1

Uses **Video ID** as the primary cache key.

Cache stores:
* `videoId`
* `verdict`
* `evidence`
* `narrative`
* `transcriptLength`
* `analyzedAtProgress`

Reasoning:
* Embeddings can accidentally merge opposite narratives.
* Transcript hashes change over time as more captions arrive.
* Video IDs are stable.

Workflow:
`videoId` → Cache lookup
* **If found**: return cached verdict instantly, skip retrieval, skip AI, skip processing.
* **If not found**: run full verification, store result by `videoId`.

---

## Future Roadmap

### Phase 1
* Video-level cache
* Narrative verification
* Retrieval-first architecture

### Phase 2
* Global cache service
* Shared verdicts across devices

Example:
User A watches a Short
↓
verification runs
↓
result stored

User B watches same Short on another device
↓
result returned instantly

### Phase 3
* Narrative graph
* Cross-platform narrative reuse
* Narrative clustering

---

## Processing Steps

### 1. Transcript Collection & Stabilization
Captions are collected while the user watches. The Transcript Stabilizer handles duplicates and formatting, keeping a clean representation.

### 2. Narrative Engine
Transforms the full transcript into a narrative representation using semantic embeddings, avoiding basic keyword matching.

### 3. Video ID Cache Check
Searches the local database for existing analysis for the current video.

### 4. Evidence Retrieval
Driven by the entire narrative rather than sentence fragments, pulling from PubMed, Google Fact Check, and Google News RSS.

### 5. Verdict Builder
Locally compares the Narrative vs. Retrieved Evidence to generate verdicts like "Supported by evidence", "Evidence is mixed", or "Not supported by evidence". 

Fallback AI (Gemini / OpenRouter) is only triggered if confidence is extremely low and API keys are provided.
