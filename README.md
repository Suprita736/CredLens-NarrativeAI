# CredLens NarrativeAI

## AI-Powered Narrative Verification for YouTube Shorts

CredLens NarrativeAI is a Chrome Extension that analyzes YouTube Shorts and evaluates the overall narrative presented in a video using evidence retrieved from trusted sources.

Unlike traditional fact-checking systems that verify isolated statements or rely heavily on keyword matching, CredLens waits until sufficient context is available, constructs a narrative understanding of the video, retrieves supporting evidence, and generates an evidence-based assessment.

Claims that are identified as **Insufficient Evidence**, **Misleading**, or **Exaggerated** are automatically archived into a public knowledge base, allowing users to explore and review previously analyzed content.

---

## The Problem

Most misinformation is communicated through narratives rather than individual statements.

Traditional verification systems often:

* Analyze incomplete transcripts
* Trigger verification too early
* Depend heavily on keyword matching
* Miss the creator's actual message
* Fail to evaluate the overall context of a video

As a result, many misleading narratives can appear credible despite individual statements being technically true.

CredLens addresses this by evaluating the complete narrative instead of isolated transcript fragments.

---

## How CredLens Works

```text
YouTube Short
      ↓
Transcript Collection
      ↓
Dynamic Watch Gate
      ↓
Transcript Stabilization
      ↓
Claim Worthiness Filter
      ↓
Narrative Synthesis
      ↓
Evidence Retrieval
      ↓
Evidence Evaluation
      ↓
Verdict Generation
      ↓
Knowledge Base Archive
```

---

## Key Features

### Narrative-Based Verification

Rather than fact-checking individual sentences, CredLens analyzes the creator's complete narrative.

Example:

Transcript:

* "Leaky gut causes eczema."
* "Leaky gut causes rosacea."
* "Ghee repairs gut lining."

Narrative Understanding:

> The creator argues that gut dysfunction contributes to skin disorders and that dietary interventions such as ghee may improve gut health.

Verification is performed on this narrative representation.

---

### Dynamic Watch Gate

Verification begins only after sufficient context has been collected.

The system dynamically adapts to:

* Video length
* Transcript completeness
* Caption stability

This prevents premature verification while still allowing short videos to be analyzed.

---

### Transcript Stabilization

The transcript pipeline continuously cleans and stabilizes captions before analysis.

Features include:

* Duplicate caption removal
* Active caption tracking
* Video-to-video transcript isolation
* Transcript contamination prevention

---

### Claim Worthiness Filtering

Not every video should be analyzed.

CredLens automatically filters out:

* Music videos
* Entertainment clips
* Vlogs
* Reaction content
* Low-information transcripts
* Non-factual conversations

Only videos containing meaningful factual assertions proceed to verification.

---

### Domain-Aware Evidence Retrieval

Evidence retrieval is tailored to the type of claim being evaluated.

Sources include:

* PubMed
* Google Fact Check Tools
* Google News RSS

Examples:

* Health and nutrition claims prioritize scientific literature.
* Current events and political claims prioritize recent reporting.
* Technology and science claims use both academic and news sources.

---

### Evidence Evaluation

Retrieved evidence is analyzed against the video's narrative.

The system determines whether evidence:

* Supports the claim
* Contradicts the claim
* Provides mixed evidence
* Is insufficient to verify the claim

A structured assessment explains the reasoning behind the verdict.

---

### Evidence-Based Verdicts

Possible outcomes include:

* Supported
* Misleading
* Exaggerated
* Insufficient Evidence

Each verdict contains:

* Narrative Summary
* Central Claim
* Supporting Claims
* Evidence Assessment
* Evidence Strength
* Supporting Sources

---

### Public Knowledge Base

Claims classified as:

* Insufficient Evidence
* Misleading
* Exaggerated

are automatically archived in a Supabase-backed public knowledge base.

Each archived entry stores:

* Video metadata
* Transcript
* Narrative summary
* Central claim
* Supporting claims
* Retrieved evidence
* Assessment reasoning
* Evidence strength

Users can browse previously analyzed content and review supporting evidence.

---

## Reliability Features

### Video-Level Caching

Each analyzed video is cached using its YouTube Video ID.

Cached data includes:

* Narrative summary
* Claims
* Evidence
* Verdict
* Analysis metadata

Benefits:

* Faster revisits
* Reduced API usage
* Lower verification cost

---

### Background Processing

Verification continues even if users scroll away from a Short.

Completed analyses remain available through caching and are immediately displayed when revisiting the same video.

---

### Transcript Isolation

Each YouTube Short maintains an independent analysis state.

Switching videos automatically resets:

* Transcript buffers
* Caption history
* Verification state
* Progress tracking

This prevents cross-video contamination.

---

## Technology Stack

### Frontend

* React
* TypeScript
* Vite
* Tailwind CSS

### Chrome Extension

* Manifest V3
* Chrome Storage API

### AI & Retrieval

* OpenRouter
* Claude 3.5 Haiku
* PubMed API
* Google Fact Check Tools API
* Google News RSS

### Data Layer

* Supabase
* PostgreSQL
* Row Level Security (RLS)

---

## Installation

### Frontend

```bash
npm install
npm run dev
```

Create a `.env` file:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Chrome Extension

```bash
npm install
npm run build
```

Load the extension:

1. Open Chrome
2. Navigate to `chrome://extensions`
3. Enable Developer Mode
4. Click **Load Unpacked**
5. Select the extension build directory

---

## Screenshots

### Extension Popup

Configure API keys and view the retrieval pipeline used for narrative verification.

![Extension popup](image-3.png)

### Analysis Overlay

CredLens analyzes the narrative of a YouTube Short and generates an evidence-based assessment.

![analysis overlay](image-4.png)

### Knowledge Base

Public archive of analyzed claims with verdicts, confidence levels, and evidence summaries.

![knowledge base](image-5.png)

### Claim Detail Page

Detailed claim analysis including supporting evidence, assessment reasoning, and verification results.

![claim detail](image-1.png)

### Statistics Dashboard

![Statistics Dashboard](image-2.png)

---

## Demo video

[CreadLensAI demo video](https://youtu.be/skkCTtPmAdw)

---

## Project Goal

CredLens aims to improve transparency in short-form content by helping users understand whether the overall narrative presented in a video is supported by credible evidence.

Rather than replacing human judgment, CredLens provides context, evidence, and structured assessments that enable users to make more informed decisions about the information they consume.
