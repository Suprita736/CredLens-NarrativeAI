# CredLens NarrativeAI

## Phase 1 – Narrative Verification Foundation

CredLens NarrativeAI verifies the overall narrative of a YouTube Short rather than isolated sentences or keyword-matched claims.

The goal is to reduce API dependency, improve contextual understanding, and provide evidence-based narrative verification.

---

## Vision

Most misinformation is communicated through narratives rather than individual claims.

Traditional fact-checkers attempt to verify isolated statements.

CredLens instead attempts to understand:

* What story the creator is telling
* What conclusion the viewer is expected to believe
* Whether the overall narrative is supported by evidence

Example:

Video narrative:

"Soy products, flax seeds and cruciferous vegetables damage hormonal health."

CredLens output:

"The video largely exaggerates the hormonal risks of common foods. Current evidence does not support the claim that moderate soy consumption causes estrogen dominance, and evidence for hormonal harm from flax seeds or cruciferous vegetables is weak."

---

## Architecture

YouTube Short
↓
Transcript Collection
↓
Transcript Stabilizer
↓
Narrative Engine
↓
Narrative Cache Check
↓
Evidence Retrieval
↓
Verdict Builder
↓
Credibility Overlay

---

## Processing Flow

### Step 1 — Transcript Collection

Captions are collected while the user watches the Short.

No verification occurs immediately.

This prevents incomplete narratives from being analyzed.

---

### Step 2 — Watch Completion Gate

Verification begins only when:

* the video finishes, or
* the user watches at least 80–90% of the Short

This ensures the narrative is complete before analysis begins.

---

### Step 3 — Transcript Stabilization

The Transcript Stabilizer removes:

* duplicate caption updates
* partial caption fragments
* rapidly changing intermediate text

Result:

A stable transcript representing the full video.

---

### Step 4 — Narrative Engine

The Narrative Engine transforms the transcript into a narrative representation.

Example:

Transcript:

"Leaky gut causes eczema and rosacea. Ghee repairs the gut lining."

Narrative Representation:

"The creator argues that gut dysfunction causes skin disease and that dietary interventions such as ghee can restore gut health."

The system analyzes meaning rather than isolated keywords.

---

### Step 5 — Narrative Cache

Before retrieval, CredLens checks whether this narrative has already been analyzed.

Cache stores:

* video ID
* narrative fingerprint
* evidence bundle
* verdict

If a match exists:

Retrieval is skipped.

Results are returned instantly.

---

### Step 6 — Evidence Retrieval

Retrieval is driven by the narrative, not by sentence fragments.

Sources:

* PubMed
* Google Fact Check
* Google News RSS

Goal:

Find evidence relevant to the narrative as a whole.

---

### Step 7 — Verdict Builder

The Verdict Builder compares:

Narrative
vs
Retrieved Evidence

Possible outcomes:

* Supported by evidence
* Partially supported
* Evidence is mixed
* Not supported by evidence
* Exaggerated claim

Verdicts are generated locally whenever possible.

---

### Step 8 — Fallback AI

Gemini and OpenRouter are optional.

They are used only when:

* evidence confidence is extremely low
* retrieved sources conflict heavily
* a local verdict cannot be generated

Normal operation should not depend on either service.

---

## Caching Strategy

### Local Cache

Stores results on-device.

Used for:

* repeated views
* browser refreshes
* revisiting Shorts

### Future Global Cache

Planned Phase 2 feature.

Allows identical Shorts watched on different devices to reuse previously generated narrative verdicts.

---

## Core Components

* transcriptStabilizer.ts
* semanticEmbedder.ts
* narrativeEngine.ts
* retrievalEngine.ts
* verdictBuilder.ts
* cacheService.ts

---

## Current Phase Limitations

Phase 1 focuses on:

* narrative representation
* retrieval-first verification
* local caching
* evidence-driven verdicts

Future phases will improve:

* semantic contradiction detection
* cross-video narrative clustering
* global narrative caching
* narrative reasoning accuracy
