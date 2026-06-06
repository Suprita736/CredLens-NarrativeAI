import type { NarrativeSynthesis } from '../types';

const OPENROUTER_ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';
const HAIKU_MODEL = 'anthropic/claude-3.5-haiku';
const TIMEOUT_MS = 15000;

export interface GeneratedQueries {
  pubmedQueries: string[];
  factCheckQueries: string[];
  newsQueries: string[];
}

export async function generateRetrievalQueries(
  synthesis: NarrativeSynthesis,
  apiKey: string,
  signal?: AbortSignal
): Promise<GeneratedQueries> {
  const prompt = `You are a search specialist.
Generate retrieval queries ONLY.
Do not summarize.
Do not infer concepts.
Do not introduce terminology not explicitly present in the claim.
Preserve biomedical accuracy.
Return JSON only.

Central Claim: "${synthesis.central_claim}"
Supporting Claims:
${synthesis.supporting_claims.map(c => `- ${c}`).join('\n')}
Domain: ${synthesis.claim_domain}

Rules:
- Every term in your queries must appear in, or be a direct clinical synonym of, 
  a term in the input claim.
- A "direct clinical synonym" means a term that shares the same referent in medical 
  literature (e.g. "renal" for "kidney"). It does NOT mean a related concept, 
  a mechanism that could explain the claim, or a broader category.
- If a concept is not stated in the claim, it does not appear in any query.
- Queries must be 3–6 words. No full sentences.
- Generate distinct queries — do not paraphrase the same idea twice.

Output JSON format:
{
  "pubmedQueries": ["3-5 word query", "another query"],
  "factCheckQueries": ["query"],
  "newsQueries": ["query"]
}`;

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
        max_tokens: 500,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`OpenRouter error ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty content');
    const jsonStr = content.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
    return JSON.parse(jsonStr) as GeneratedQueries;
  } catch (err: any) {
    clearTimeout(timeout);
    console.error('[QueryGeneration] failed:', err?.message);
    return { pubmedQueries: [], factCheckQueries: [], newsQueries: [] };
  }
}
