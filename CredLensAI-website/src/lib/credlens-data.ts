import { supabase } from "./supabase";

export type ClaimStatus = "pending_review" | "reviewed" | "published";

export interface CorrectedClaim {
  original: string;
  correction: string;
  evidenceStrength: "Strong" | "Moderate" | "Limited";
  explanation: string;
}

export interface ClaimSource {
  name: string;
  type: string;
  url: string;
}

export interface Claim {
  id: string;
  videoId: string;
  channel: string;
  thumbnail: string;
  detectedAt: string;
  verdict: string;
  confidence: number;
  domain: string;
  status: ClaimStatus;
  centralClaim: string;
  originalClaims: string[];
  evidence: {
    pubmedStudies: number;
    trustedSources: number;
    directSupporting: number;
    missing: string;
    failureReason: string;
  };
  corrected: CorrectedClaim[];
  sources: ClaimSource[];
  aiAssessment?: string;
  evidenceStrength?: string;
  expertCorrection?: string;
}

const thumb = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=70`;



function mapRowToClaim(row: any): Claim {
  return {
    id: row.id,
    videoId: row.video_id,
    channel: row.channel || row.channel_name || "Unknown",
    thumbnail: row.thumbnail || row.thumbnail_url || thumb("1571019613454-1cb2f99b2d8b"),
    detectedAt: row.detected_at || row.created_at,
    verdict: row.verdict || "Insufficient Evidence",
    confidence: row.confidence != null ? Number(row.confidence) : 0,
    domain: row.domain || "General",
    status: row.status as ClaimStatus,
    centralClaim: row.central_claim,
    originalClaims: Array.isArray(row.original_claims) && row.original_claims.length > 0 
      ? row.original_claims 
      : (Array.isArray(row.supporting_claims) ? row.supporting_claims : []),
    evidence: {
      failureReason: row.evidence?.failureReason || row.failure_reason || "No explanation provided.",
      pubmedStudies: row.evidence?.pubmedStudies || row.evidence_retrieved?.research?.length || 0,
      trustedSources: row.evidence?.trustedSources || row.evidence_retrieved?.news?.length || 0,
      directSupporting: row.evidence?.directSupporting || 0,
      missing: row.evidence?.missing || "Awaiting manual review."
    },
    corrected: Array.isArray(row.corrected) ? row.corrected : [],
    sources: Array.isArray(row.sources) ? row.sources : [],
    aiAssessment: row.ai_assessment,
    evidenceStrength: row.evidence_strength,
    expertCorrection: row.expert_correction,
  };
}

export async function fetchClaims(): Promise<Claim[]> {
  try {
    const { data, error } = await supabase
      .from("insufficient_claims")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching claims:", error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    return data.map(mapRowToClaim);
  } catch (err) {
    console.error("Exception fetching claims:", err);
    return [];
  }
}

export async function fetchClaim(id: string): Promise<Claim | null> {
  try {
    const { data, error } = await supabase
      .from("insufficient_claims")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) {
      return null;
    }

    return mapRowToClaim(data);
  } catch (err) {
    console.error("Exception fetching claim:", err);
    return null;
  }
}

export interface Stats {
  overview: {
    wrongClaimsToday: number;
    videosReviewedToday: number;
    correctionsPublishedToday: number;
    mostActiveDomain: string;
    wrongClaimsLogged: number;
    videosCovered: number;
    correctionsWritten: number;
    coveragePct: number;
  };
  daily: Array<{ day: string; claims: number }>;
  domains: Array<{ name: string; value: number }>;
  topClaims: Array<{ claim: string; occurrences: number; domain: string; status: string }>;
  recent: Array<{ title: string; time: string; domain: string }>;
}

export async function fetchStats(): Promise<Stats> {
  const emptyStats: Stats = {
    overview: {
      wrongClaimsToday: 0,
      videosReviewedToday: 0,
      correctionsPublishedToday: 0,
      mostActiveDomain: "None",
      wrongClaimsLogged: 0,
      videosCovered: 0,
      correctionsWritten: 0,
      coveragePct: 0,
    },
    daily: [],
    domains: [],
    topClaims: [],
    recent: [],
  };

  try {
    const { data, error } = await supabase.from("insufficient_claims").select("*");

    if (error || !data || data.length === 0) {
      return emptyStats;
    }

    const wrongClaimsLogged = data.length;
    const videosCovered = new Set(data.map((row) => row.video_id)).size;
    
    let correctionsWritten = 0;
    const domainCounts: Record<string, number> = {};
    const dateCounts: Record<string, number> = {};

    data.forEach((row) => {
      if (row.corrected && Array.isArray(row.corrected) && row.corrected.length > 0) {
        correctionsWritten++;
      }
      
      const domain = row.domain || "General";
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;

      const dateStr = new Date(row.created_at || row.detected_at || Date.now()).toLocaleDateString();
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });

    const coveragePct = wrongClaimsLogged > 0 ? Math.round((correctionsWritten / wrongClaimsLogged) * 100) : 0;
    
    let mostActiveDomain = "General";
    let maxDomainCount = 0;
    for (const [domain, count] of Object.entries(domainCounts)) {
      if (count > maxDomainCount) {
        maxDomainCount = count;
        mostActiveDomain = domain;
      }
    }

    const domains = Object.entries(domainCounts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    const sortedByDate = [...data].sort((a, b) => {
      const dateA = new Date(a.created_at || a.detected_at || 0).getTime();
      const dateB = new Date(b.created_at || b.detected_at || 0).getTime();
      return dateB - dateA;
    });

    const recent = sortedByDate.slice(0, 4).map((row) => ({
      title: row.central_claim,
      time: row.created_at ? new Date(row.created_at).toLocaleDateString() : row.detected_at,
      domain: row.domain || "General",
    }));

    const claimCounts: Record<string, { occurrences: number; domain: string; status: string }> = {};
    data.forEach((row) => {
      const claim = row.central_claim;
      if (!claimCounts[claim]) {
        claimCounts[claim] = { occurrences: 0, domain: row.domain || "General", status: row.status };
      }
      claimCounts[claim].occurrences++;
    });

    const topClaims = Object.entries(claimCounts)
      .map(([claim, info]) => ({
        claim,
        occurrences: info.occurrences,
        domain: info.domain,
        status: info.status.charAt(0).toUpperCase() + info.status.slice(1),
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 5);

    const daily = Object.entries(dateCounts).map(([day, claims]) => ({ day, claims })).sort((a, b) => new Date(a.day).getTime() - new Date(b.day).getTime()).slice(-30);

    return {
      overview: {
        wrongClaimsToday: wrongClaimsLogged,
        videosReviewedToday: videosCovered,
        correctionsPublishedToday: correctionsWritten,
        mostActiveDomain,
        wrongClaimsLogged,
        videosCovered,
        correctionsWritten,
        coveragePct,
      },
      daily,
      domains,
      topClaims,
      recent,
    };
  } catch (err) {
    console.error("Exception fetching stats:", err);
    return emptyStats;
  }
}
