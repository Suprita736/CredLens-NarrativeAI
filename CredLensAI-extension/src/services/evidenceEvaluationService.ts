// src/services/evidenceEvaluationService.ts — CredLens Pass 2
//
// Sends central_claim + supporting_claims + retrieved evidence snippets
// to Claude 3.5 Haiku and receives a structured evidence evaluation.
// This is the fix for "evidence exists → increase score" failure mode.

import type { NarrativeSynthesis, ResearchArticle, NewsArticle } from '../types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const HAIKU_MODEL = 'anthropic/claude-3.5-haiku';
const TIMEOUT_MS = 15000;

export type SupportVerdict = 'supports' | 'contradicts' | 'mixed' | 'unrelated';
export type OverallVerdict = 'supports' | 'exaggerated' | 'misleading' | 'insufficient_evidence';

export interface ClaimEvaluation {
  claim: string;
  support_verdict: SupportVerdict;
  evidence_confidence: number; // 0-100
  key_caveat: string;
  reasoning: string;
}

export interface EvidenceClassification {
  source_id: string;
  classification: SupportVerdict;
}

export interface EvidenceEvaluation {
  claim_evaluations: ClaimEvaluation[];
  evidence_classifications: EvidenceClassification[];
  overall_verdict: OverallVerdict;
  overall_confidence: number; // 0-100
  narrative_assessment: string; // 2 sentences shown to user
}



function extractConclusion(abstract: string): string {
  const match = abstract.match(/(?:Conclusion|Conclusions|Summary):\\s*(.*)/i);
  if (match) return match[1].trim();
  const sentences = abstract.split(/(?<=\\.)\\s+/);
  return sentences.slice(-2).join(' ').trim();
}

function buildEvidenceSnippets(
  research: ResearchArticle[],
  news: NewsArticle[]
): string {
  const snippets: string[] = [];

  research.slice(0, 3).forEach((article: any, i) => {
    const conclusion = article.abstract
      ? extractConclusion(article.abstract)
      : 'Abstract not available';
    snippets.push(
      `[${i + 1}] PubMed — "${article.title}" (${article.journal}, ${article.date.split(' ')[0]})\\n    Finding: ${conclusion}`
    );
  });

  news.slice(0, 2).forEach((article, i) => {
    snippets.push(`[${research.slice(0, 3).length + i + 1}] News — "${article.title}" (${article.source})`);
  });

  return snippets.length > 0
    ? snippets.join('\n')
    : 'No external evidence retrieved.';
}

function buildEvaluationPrompt(
  synthesis: NarrativeSynthesis,
  research: ResearchArticle[],
  news: NewsArticle[]
): string {
  const evidenceSnippets = buildEvidenceSnippets(research, news);
  const supportingClaimsList = synthesis.supporting_claims
    .slice(0, 4)
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  let domainWeights = "All sources equally";
  const d = synthesis.claim_domain.toLowerCase();
  if (d.includes('health') || d.includes('nutrition') || d.includes('medicine')) {
    domainWeights = "Primary evidence source: PubMed (80%), Supplementary source: News (20%)";
  } else if (d.includes('politics')) {
    domainWeights = "Primary evidence source: Fact Check (50%), Supplementary source: News (50%)";
  } else if (d.includes('current')) {
    domainWeights = "Primary evidence source: News (70%), Supplementary source: Fact Check (30%)";
  } else if (d.includes('science')) {
    domainWeights = "Primary evidence source: PubMed (70%), Supplementary source: News (30%)";
  }

  return `You are an evidence analyst. Your job is to determine whether retrieved evidence supports or contradicts a health claim.

Central claim: "${synthesis.central_claim}"
Domain: ${synthesis.claim_domain}
Weights: ${domainWeights}

Supporting claims:
${supportingClaimsList || '(none)'}

Retrieved evidence:
${evidenceSnippets}

For each supporting claim, output a JSON object in claim_evaluations.
Then output a final overall assessment.

Rules:
- The evaluator should primarily rely on the Primary evidence source when judging claims.
- Evidence that applies only to diseased populations does NOT support claims about healthy adults.
- A single study finding is weaker than multiple converging findings.
- Qualified conclusions ("may", "appears to") reduce evidence_confidence.
- Contradicting evidence MUST be reflected in the overall_verdict.
- overall_confidence reflects how certain the evidence is, NOT how many articles were found.
- If evidence says something is SAFE and the claim says it is HARMFUL, the support_verdict is "contradicts".

Return only valid JSON. No preamble. No markdown.

{
  "claim_evaluations": [
    {
      "claim": "exact claim text",
      "support_verdict": "supports | contradicts | mixed | unrelated",
      "evidence_confidence": 0-100,
      "key_caveat": "one sentence about who this applies to or conditions",
      "reasoning": "one sentence about what the evidence actually says"
    }
  ],
  "evidence_classifications": [
    {
      "source_id": "exact [1] or [2] reference prefix from retrieved evidence",
      "classification": "supports | contradicts | mixed | unrelated"
    }
  ],
  "overall_verdict": "supports | exaggerated | misleading | insufficient_evidence",
  "overall_confidence": 0-100,
  "narrative_assessment": "Two sentences shown to the user summarizing what the evidence says about this narrative."
}`;
}

export async function evaluateEvidence(
  synthesis: NarrativeSynthesis,
  research: ResearchArticle[],
  news: NewsArticle[],
  apiKey: string,
  signal?: AbortSignal
): Promise<EvidenceEvaluation | null> {
  if (!apiKey) return null;
  if (research.length === 0 && news.length === 0) return null;

  const prompt = buildEvaluationPrompt(synthesis, research, news);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeout);
      throw new DOMException('Aborted', 'AbortError');
    }
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    console.log('[EvidenceEvaluation] Sending evidence to Haiku for evaluation...');

    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://credlens.ai',
        'X-Title': 'CredLens NarrativeAI',
      },
      body: JSON.stringify({
        model: HAIKU_MODEL,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EvidenceEvaluation] OpenRouter error ${response.status}: ${errorText}`);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    const evaluation = JSON.parse(jsonStr) as EvidenceEvaluation;

    console.log('[EvidenceEvaluation] Complete:');
    console.log(`  Overall verdict: ${evaluation.overall_verdict}`);
    console.log(`  Overall confidence: ${evaluation.overall_confidence}`);
    console.log(`  Assessment: ${evaluation.narrative_assessment}`);

    return evaluation;

  } catch (err: any) {
    clearTimeout(timeout);
    if (err?.name === 'AbortError') throw err;
    console.error('[EvidenceEvaluation] Failed:', err?.message);
    return null;
  }
}
