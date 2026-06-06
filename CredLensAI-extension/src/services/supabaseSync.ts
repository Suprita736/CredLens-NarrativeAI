import type { NarrativeAnalysis, NarrativeSynthesis, EvidenceBundle } from '../types';
import type { EvidenceEvaluation } from './evidenceEvaluationService';

export async function syncInsufficientEvidence(
  videoId: string,
  videoTitle: string,
  channelName: string,
  transcript: string,
  analysis: NarrativeAnalysis,
  synthesis: NarrativeSynthesis,
  evidence: EvidenceBundle,
  evaluation: EvidenceEvaluation | null,
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<string | null> {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn('[SupabaseSync] Missing Supabase configuration');
    return null;
  }

  console.log('[SupabaseSync] Upload started');

  const pubmedIds = evidence.healthResearch?.map(r => r.id) || [];
  const sourceUrls = [
    ...(evidence.healthResearch?.map(r => r.url) || []),
    ...(evidence.newsArticles?.map(n => n.url) || []),
    ...(evidence.factCheck?.url ? [evidence.factCheck.url] : [])
  ];

  let evidenceStrength = 'Insufficient';
  if (analysis.confidence >= 70) evidenceStrength = 'Strong';
  else if (analysis.confidence >= 50) evidenceStrength = 'Moderate';
  else if (analysis.confidence >= 30) evidenceStrength = 'Weak';

  const payload = {
    video_id: videoId,
    video_title: videoTitle,
    youtube_url: `https://www.youtube.com/shorts/${videoId}`,
    channel_name: channelName,
    thumbnail_url: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    transcript: transcript,
    narrative_summary: synthesis.narrative_summary,
    central_claim: synthesis.central_claim,
    supporting_claims: synthesis.supporting_claims,
    domain: synthesis.claim_domain,
    verdict: analysis.verdict,
    confidence: analysis.confidence,
    evidence_retrieved: {
      factCheck: evidence.factCheck,
      research: evidence.healthResearch,
      news: evidence.newsArticles,
      classifications: evaluation?.evidence_classifications || []
    },
    failure_reason: evaluation?.narrative_assessment || analysis.explanation,
    status: 'pending_review',
    review_status: 'pending_review',
    pubmed_ids: pubmedIds,
    source_urls: sourceUrls,
    ai_assessment: evaluation?.narrative_assessment || analysis.explanation,
    evidence_strength: evidenceStrength
  };

  const url = `${supabaseUrl}/rest/v1/insufficient_claims?on_conflict=video_id`;
  
  let attempt = 0;
  const maxRetries = 1;

  while (attempt <= maxRetries) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s request timeout

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Prefer': 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Status ${response.status}: ${await response.text()}`);
      }

      const data = await response.json();
      console.log('[SupabaseSync] Upload success');
      return data?.[0]?.id || null;
    } catch (err: any) {
      attempt++;
      if (attempt > maxRetries) {
        console.error('[SupabaseSync] Upload failed:', err.message);
        return null;
      }
      console.warn(`[SupabaseSync] Upload failed, retrying in 2 seconds (Attempt ${attempt}):`, err.message);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  return null;
}
