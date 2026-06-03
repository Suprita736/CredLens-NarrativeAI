# CredLens NarrativeAI

## Overview

CredLens NarrativeAI is a Chrome Extension that analyzes YouTube Shorts and verifies the overall narrative presented in a video rather than relying on isolated claims or keyword matching.

Instead of fact-checking individual phrases as they appear, CredLens waits until a user has watched most of a Short, constructs a complete narrative representation, retrieves supporting evidence from trusted sources, and generates an evidence-based verdict.

---

## Problem Statement

Most misinformation is communicated through narratives rather than individual statements.

Traditional approaches often:

* Verify incomplete transcripts
* Depend on keyword matching
* Trigger verification too early
* Produce unreliable results from fragmented context

CredLens addresses this by analyzing the complete narrative of a Short before verification begins.

---

## Architecture

```text
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
Video Cache Check
      ↓
Evidence Retrieval
      ↓
Verdict Builder
      ↓
Credibility Overlay
```

---

## Core Features

### Narrative-Based Verification

CredLens focuses on understanding the creator's overall message instead of isolated transcript fragments.

Example:

Transcript:

"Leaky gut causes eczema.
Leaky gut causes rosacea.
Ghee repairs gut lining."

Narrative:

"The creator argues that gut dysfunction causes skin disease and that dietary interventions such as ghee can improve gut health."

Verification is performed on this narrative representation.

---

### Watch Completion Gate

Verification is intentionally delayed until sufficient context is available.

Verification begins only when:

* The Short has ended naturally, or
* The viewer has watched at least 85% of the video

During playback, the extension only collects and stabilizes captions.

No retrieval or verification occurs before the gate is satisfied.

---

### Transcript Stabilization

The transcript pipeline:

* Removes duplicate caption updates
* Prevents transcript contamination between Shorts
* Tracks only active caption containers
* Maintains a clean narrative-ready transcript

This ensures verification operates on reliable input.

---

### Claim Identification

After the watch gate is satisfied, the system extracts factual statements from the completed transcript.

Example:

Claims Identified:

* Excessive protein shakes damage kidneys
* Creatine causes kidney injury
* Hyperfiltration leads to fibrosis

Non-factual fragments and conversational filler are discarded automatically.

---

### Evidence Retrieval

For each identified claim, CredLens generates focused evidence queries and retrieves supporting information from trusted sources.

Sources:

* PubMed
* Google Fact Check Tools
* Google News RSS

Example Query:

```text
protein shakes kidney damage evidence
```

---

### Verdict Builder

CredLens compares identified claims against retrieved evidence and generates an evidence-based verdict.

Possible outcomes include:

* Supported by Evidence
* Mixed Evidence
* Insufficient Evidence
* Not Supported by Evidence

The verdict includes:

* Narrative Summary
* Claims Identified
* Evidence Sources
* Final Assessment

---

## Caching Strategy

### Phase 1: Video-Level Cache

Each analyzed Short is cached using its YouTube Video ID.

Cache stores:

* Video ID
* Narrative Summary
* Claims Identified
* Evidence
* Verdict
* Transcript Length
* Analysis Progress

Benefits:

* Instant reload of previously analyzed Shorts
* Reduced API usage
* Faster user experience

If a viewer continues watching after the initial 85% analysis and the transcript changes significantly, the cache is automatically refreshed with a more complete narrative.

---

## Reliability Improvements

During development the following challenges were addressed:

### Transcript Isolation

Each Short maintains an independent transcript state.

Switching to a new Short automatically resets:

* Transcript buffer
* Caption history
* Verification state
* Progress tracking

This prevents caption leakage between videos.

### Background Verification Persistence

Verification continues even if a user scrolls away from a Short.

Completed analyses are cached and immediately available when revisiting the same video.

### Structured Claim Extraction

The system filters out:

* "That's right"
* "Watch this"
* "Number one"
* Other conversational filler

Only factual assertions are forwarded for verification.

---

## Future Roadmap

### Phase 1 (Current)

* Narrative verification
* Watch completion gate
* Video-level caching
* Retrieval-first architecture
* Evidence-based verdict generation

### Phase 2

* Global cache service
* Shared verdicts across devices
* Reduced duplicate verification costs

### Phase 3

* Narrative graph
* Cross-platform narrative reuse
* Narrative clustering and trend analysis

---

## Technology Stack

* React
* TypeScript
* Vite
* Chrome Extension Manifest V3
* PubMed API
* Google Fact Check Tools API
* Google News RSS
* Chrome Storage API

---

## Project Goal

CredLens aims to make short-form content more transparent by helping users understand whether the overall narrative presented in a video is supported by credible evidence.
