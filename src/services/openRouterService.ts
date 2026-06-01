// src/services/openRouterService.ts — CredLens NarrativeAI Phase 1
//
// OpenRouter fallback provider. Only used when evidence confidence
// is extremely low AND API key is configured.

import type { AIProvider, NarrativeAnalysis, EvidenceBundle } from '../types';

export class OpenRouterProvider implements AIProvider {
  private readonly endpoint = 'https://openrouter.ai/api/v1/chat/completions';
  private readonly model = 'openai/gpt-4o-mini';
  private readonly timeoutMs = 8000;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async analyzeNarrative(
    narrative: string,
    evidence?: EvidenceBundle
  ): Promise<NarrativeAnalysis> {
    const messages = [
      {
        role: 'system',
        content:
          'You are an expert fact-checker. Analyze the overall narrative and provide a verification result. Use only the supplied evidence. Be educational and neutral. Respond with a JSON object.',
      },
      {
        role: 'user',
        content: this.buildPrompt(narrative, evidence),
      },
    ];

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ model: this.model, messages }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`OpenRouter error ${response.status}: ${txt}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('OpenRouter returned empty content');
    }

    try {
      return JSON.parse(content) as NarrativeAnalysis;
    } catch {
      return {
        containsClaims: true,
        isSatire: false,
        verdict: 'Evidence is mixed',
        credibility: 'medium',
        confidence: 40,
        explanation: 'OpenRouter analysis could not be parsed; using evidence-based assessment.',
      };
    }
  }

  private buildPrompt(narrative: string, evidence?: EvidenceBundle): string {
    let prompt = `Narrative: "${narrative.slice(0, 500)}"\n`;
    if (evidence) {
      prompt += 'Evidence:\n';
      if (evidence.factCheck) prompt += `FactCheck: ${JSON.stringify(evidence.factCheck)}\n`;
      if (evidence.healthResearch) prompt += `Health: ${JSON.stringify(evidence.healthResearch)}\n`;
      if (evidence.newsArticles) prompt += `News: ${JSON.stringify(evidence.newsArticles)}\n`;
    }
    prompt += '\nProvide a concise narrative verification result in JSON format.';
    return prompt;
  }
}
