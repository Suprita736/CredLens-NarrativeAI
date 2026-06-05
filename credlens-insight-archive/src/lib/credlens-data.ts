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
}

const thumb = (seed: string) =>
  `https://images.unsplash.com/photo-${seed}?auto=format&fit=crop&w=1200&q=70`;

// FALLBACK DEFAULT
const fallbackClaims: Claim[] = [
  {
    id: "cl_001",
    videoId: "yt_8h2K1pQzXm",
    channel: "@FitTruthDaily",
    thumbnail: thumb("1571019613454-1cb2f99b2d8b"),
    detectedAt: "2025-05-28",
    verdict: "Insufficient Evidence",
    confidence: 0.84,
    domain: "Nutrition",
    status: "published",
    centralClaim: "Protein shakes cause permanent kidney damage in healthy adults.",
    originalClaims: [
      "Protein shakes damage kidneys.",
      "Protein powder causes kidney fibrosis.",
      "Daily whey intake leads to renal failure within 5 years.",
    ],
    evidence: {
      pubmedStudies: 12,
      trustedSources: 4,
      directSupporting: 0,
      missing: "No longitudinal study links normal protein supplementation to renal damage in healthy adults.",
      failureReason:
        "Retrieved studies focus on patients with pre-existing kidney disease. No high-quality evidence supports the generalized claim.",
    },
    corrected: [
      {
        original: "Protein shakes damage kidneys.",
        correction:
          "Current evidence does not demonstrate kidney damage in healthy adults from normal protein supplementation (1.2–2.0 g/kg/day).",
        evidenceStrength: "Strong",
        explanation:
          "Multiple meta-analyses (ISSN 2018, Devries 2018) show no adverse renal markers in healthy individuals consuming high-protein diets for up to 12 months.",
      },
      {
        original: "Protein powder causes kidney fibrosis.",
        correction:
          "There is no clinical evidence linking whey or casein protein to renal fibrosis in people with normal baseline kidney function.",
        evidenceStrength: "Strong",
        explanation:
          "Fibrosis is associated with chronic kidney disease progression, not with dietary protein intake in healthy populations.",
      },
    ],
    sources: [
      { name: "ISSN Position Stand on Protein", type: "Scientific Review", url: "https://pubmed.ncbi.nlm.nih.gov/" },
      { name: "NIH — Dietary Protein & Kidney", type: "NIH", url: "https://www.nih.gov/" },
      { name: "Devries et al. 2018 Meta-analysis", type: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/" },
      { name: "WHO Nutrition Guidelines", type: "WHO", url: "https://www.who.int/" },
    ],
  },
  {
    id: "cl_002",
    videoId: "yt_3pZ7Lq9Vt2",
    channel: "@WellnessUnfiltered",
    thumbnail: thumb("1490645935967-10de6ba17061"),
    detectedAt: "2025-05-30",
    verdict: "Insufficient Evidence",
    confidence: 0.78,
    domain: "Nutrition",
    status: "published",
    centralClaim: "Fruit smoothies destroy the liver due to fructose overload.",
    originalClaims: [
      "Fruit smoothies damage the liver.",
      "Blending fruit makes sugar 'toxic'.",
      "One smoothie a day causes fatty liver disease.",
    ],
    evidence: {
      pubmedStudies: 9,
      trustedSources: 5,
      directSupporting: 1,
      missing: "No study isolates blended whole fruit as a cause of NAFLD.",
      failureReason:
        "Evidence on fructose toxicity targets added sugars and sugar-sweetened beverages, not whole blended fruit.",
    },
    corrected: [
      {
        original: "Fruit smoothies damage the liver.",
        correction:
          "Blended whole fruit retains fiber and is not equivalent to sugar-sweetened beverages. Moderate intake is not linked to liver disease.",
        evidenceStrength: "Moderate",
        explanation:
          "AASLD guidance distinguishes between added fructose and intrinsic fruit sugars; the latter shows neutral-to-protective effects.",
      },
    ],
    sources: [
      { name: "AASLD NAFLD Guidelines", type: "Scientific Review", url: "https://www.aasld.org/" },
      { name: "Harvard T.H. Chan School", type: "Trusted Source", url: "https://www.hsph.harvard.edu/" },
      { name: "PubMed: Fruit & Liver Health", type: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/" },
    ],
  },
  {
    id: "cl_003",
    videoId: "yt_M4xR0nYbHk",
    channel: "@BiohackArena",
    thumbnail: thumb("1517836357463-d25dfeac3438"),
    detectedAt: "2025-06-01",
    verdict: "Insufficient Evidence",
    confidence: 0.81,
    domain: "Fitness",
    status: "reviewed",
    centralClaim: "Cardio exercise destroys muscle mass and accelerates aging.",
    originalClaims: [
      "Cardio eats your muscle.",
      "Running shortens your telomeres.",
      "Any zone-2 cardio is catabolic after 20 minutes.",
    ],
    evidence: {
      pubmedStudies: 18,
      trustedSources: 6,
      directSupporting: 0,
      missing: "No evidence that moderate aerobic activity reduces lean mass in resistance-trained individuals.",
      failureReason:
        "Available trials show concurrent training preserves or improves lean mass when protein and total calories are adequate.",
    },
    corrected: [
      {
        original: "Cardio eats your muscle.",
        correction:
          "Moderate aerobic exercise alongside resistance training does not reduce muscle mass when nutrition is adequate.",
        evidenceStrength: "Strong",
        explanation:
          "Schoenfeld et al. concurrent-training meta-analyses show negligible interference at typical training volumes.",
      },
    ],
    sources: [
      { name: "Schoenfeld 2021 Meta-analysis", type: "PubMed", url: "https://pubmed.ncbi.nlm.nih.gov/" },
      { name: "ACSM Position Stand", type: "Scientific Review", url: "https://www.acsm.org/" },
    ],
  },
];

const fallbackStats = {
  overview: {
    wrongClaimsToday: 14,
    videosReviewedToday: 38,
    correctionsPublishedToday: 9,
    mostActiveDomain: "Nutrition",
    wrongClaimsLogged: 128,
    videosCovered: 42,
    correctionsWritten: 92,
    coveragePct: 72,
  },
  daily: Array.from({ length: 30 }).map((_, i) => ({
    day: `D${i + 1}`,
    claims: Math.round(8 + Math.sin(i / 2.6) * 5 + ((i * 7) % 6)),
  })),
  domains: [
    { name: "Nutrition", value: 38 },
    { name: "Fitness", value: 22 },
    { name: "Health", value: 18 },
    { name: "Politics", value: 9 },
    { name: "Finance", value: 7 },
    { name: "Science", value: 6 },
  ],
  topClaims: [
    { claim: "Protein shakes damage kidneys", occurrences: 24, domain: "Nutrition", status: "Published" },
    { claim: "Fruit smoothies destroy the liver", occurrences: 19, domain: "Nutrition", status: "Published" },
    { claim: "Cardio eats your muscle", occurrences: 17, domain: "Fitness", status: "Reviewed" },
    { claim: "Seed oils cause inflammation in everyone", occurrences: 15, domain: "Nutrition", status: "Pending" },
    { claim: "Sunscreen causes more cancer than it prevents", occurrences: 12, domain: "Health", status: "Pending" },
  ],
  recent: [
    { title: "Protein shakes & kidney function", time: "2h ago", domain: "Nutrition" },
    { title: "Fruit smoothies & NAFLD", time: "6h ago", domain: "Nutrition" },
    { title: "Cardio interference effect", time: "1d ago", domain: "Fitness" },
    { title: "Cold plunge longevity claims", time: "2d ago", domain: "Health" },
  ],
};

function mapRowToClaim(row: any): Claim {
  return {
    id: row.id,
    videoId: row.video_id,
    channel: row.channel || "Unknown",
    thumbnail: row.thumbnail || thumb("1571019613454-1cb2f99b2d8b"),
    detectedAt: row.detected_at,
    verdict: row.verdict || "Insufficient Evidence",
    confidence: row.confidence != null ? Number(row.confidence) : 0,
    domain: row.domain || "General",
    status: row.status as ClaimStatus,
    centralClaim: row.central_claim,
    originalClaims: Array.isArray(row.original_claims) ? row.original_claims : [],
    evidence: typeof row.evidence === "object" && row.evidence !== null ? row.evidence : {},
    corrected: Array.isArray(row.corrected) ? row.corrected : [],
    sources: Array.isArray(row.sources) ? row.sources : [],
  };
}

export async function fetchClaims(): Promise<Claim[]> {
  try {
    const { data, error } = await supabase
      .from("insufficient_claims")
      .select("*")
      .eq("status", "published");

    if (error) {
      console.error("Error fetching claims:", error);
      return fallbackClaims;
    }

    if (!data || data.length === 0) {
      return fallbackClaims;
    }

    return data.map(mapRowToClaim);
  } catch (err) {
    console.error("Exception fetching claims:", err);
    return fallbackClaims;
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
      // Fallback
      return fallbackClaims.find((c) => c.id === id) || null;
    }

    return mapRowToClaim(data);
  } catch (err) {
    console.error("Exception fetching claim:", err);
    return fallbackClaims.find((c) => c.id === id) || null;
  }
}

export async function fetchStats(): Promise<typeof fallbackStats> {
  try {
    const { data, error } = await supabase.from("insufficient_claims").select("*");

    if (error || !data || data.length === 0) {
      return fallbackStats;
    }

    const wrongClaimsLogged = data.length;
    const videosCovered = new Set(data.map((row) => row.video_id)).size;
    
    let correctionsWritten = 0;
    const domainCounts: Record<string, number> = {};

    data.forEach((row) => {
      if (row.corrected && Array.isArray(row.corrected) && row.corrected.length > 0) {
        correctionsWritten++;
      }
      
      const domain = row.domain || "General";
      domainCounts[domain] = (domainCounts[domain] || 0) + 1;
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

    // Compute derived recent claims
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

    // Top claims (simplified grouping by central_claim)
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

    return {
      overview: {
        wrongClaimsToday: wrongClaimsLogged, // simplified
        videosReviewedToday: videosCovered, // simplified
        correctionsPublishedToday: correctionsWritten, // simplified
        mostActiveDomain,
        wrongClaimsLogged,
        videosCovered,
        correctionsWritten,
        coveragePct,
      },
      daily: fallbackStats.daily, // Keep fallback for daily chart since we don't have historical data readily available
      domains: domains.length > 0 ? domains : fallbackStats.domains,
      topClaims: topClaims.length > 0 ? topClaims : fallbackStats.topClaims,
      recent: recent.length > 0 ? recent : fallbackStats.recent,
    };
  } catch (err) {
    console.error("Exception fetching stats:", err);
    return fallbackStats;
  }
}
