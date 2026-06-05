import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  FileSearch,
  FlaskConical,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  XCircle,
} from "lucide-react";
import { SiteShell } from "@/components/site-shell";
import { type Claim } from "@/lib/credlens-data";

export const Route = createFileRoute("/claims/$claimId")({
  head: ({ params }) => {
    return {
      meta: [
        { title: `CredLens Claim` },
      ],
    };
  },
  loader: async ({ params }) => {
    const { fetchClaim } = await import("@/lib/credlens-data");
    const claim = await fetchClaim(params.claimId);
    if (!claim) throw notFound();
    return claim;
  },
  component: ClaimPage,
});

function ClaimPage() {
  const claim = Route.useLoaderData() as Claim;

  const { data: allClaims = [] } = useQuery({
    queryKey: ["claims"],
    queryFn: () => import("@/lib/credlens-data").then(m => m.fetchClaims()),
    staleTime: 60_000,
  });
  const others = allClaims.filter(c => c.id !== claim.id);

  // We load fetchStats here statically or just fallback to avoid more loaders
  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: () => import("@/lib/credlens-data").then(m => m.fetchStats()),
  });

  if (!stats) return null;

  return (
    <SiteShell>
      <div className="relative mx-auto max-w-7xl px-6 pt-10 pb-20">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to home
        </Link>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mt-6 max-w-4xl"
        >
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-primary/10 text-primary border border-primary/30 px-2.5 py-0.5">
              {claim.domain}
            </span>
            <span className="rounded-full glass px-2.5 py-0.5 text-muted-foreground">
              Status · {claim.status.replace("_", " ")}
            </span>
            <span className="text-muted-foreground">{claim.detectedAt}</span>
          </div>
          <h1 className="mt-4 text-3xl md:text-5xl font-semibold tracking-tight leading-[1.05]">
            {claim.centralClaim}
          </h1>
        </motion.div>

        {/* Top metrics */}
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <MetricCard
            label="Wrong Claims Logged"
            value={stats.overview.wrongClaimsLogged}
            sub={`Across ${stats.overview.videosCovered} videos`}
            accent="primary"
          />
          <MetricCard
            label="Corrections Written"
            value={stats.overview.correctionsWritten}
            sub={`${stats.overview.coveragePct}% coverage`}
            accent="secondary"
          />
          <MetricCard label="Top Domain" value={stats.overview.mostActiveDomain} sub="Most frequent category" />
        </div>

        {/* Main */}
        <div className="mt-12 grid gap-8 lg:grid-cols-[1.15fr_1fr]">
          {/* Left column */}
          <div className="space-y-8">
            {/* Video */}
            <Card>
              <CardHeader icon={PlayCircle} title="Original Video" />
              <div className="grid sm:grid-cols-[200px_1fr] gap-5 mt-5">
                <div className="relative rounded-xl overflow-hidden border border-border aspect-video sm:aspect-square">
                  <img src={claim.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent" />
                  <PlayCircle className="absolute inset-0 m-auto h-10 w-10 text-white/90 drop-shadow" />
                </div>
                <div className="space-y-2 text-sm">
                  <KV k="Video ID" v={<code className="font-mono text-xs">{claim.videoId}</code>} />
                  <KV k="Channel" v={claim.channel} />
                  <KV k="Detected" v={claim.detectedAt} />
                  <KV
                    k="CredLens Verdict"
                    v={
                      <span className="inline-flex items-center gap-1.5 text-primary">
                        <ShieldCheck className="h-3.5 w-3.5" /> {claim.verdict}
                      </span>
                    }
                  />
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                      <span>Confidence</span>
                      <span>{Math.round(claim.confidence * 100)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${claim.confidence * 100}%` }}
                        transition={{ duration: 1, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-primary to-secondary"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Original claims */}
            <Card>
              <CardHeader icon={FileSearch} title="Original Claims" />
              <ul className="mt-5 space-y-3">
                {claim.originalClaims.map((c, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 rounded-xl border border-border bg-white/[0.02] p-4"
                  >
                    <XCircle className="h-4 w-4 mt-0.5 text-destructive/80 shrink-0" />
                    <span className="text-sm">{c}</span>
                  </motion.li>
                ))}
              </ul>
            </Card>

            {/* Why verification failed */}
            <Card>
              <CardHeader icon={FlaskConical} title="Why Verification Failed" />
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                {claim.evidence.failureReason}
              </p>
              <div className="mt-5 grid grid-cols-3 gap-3">
                <EvidenceStat label="PubMed Studies Found" value={claim.evidence.pubmedStudies} />
                <EvidenceStat label="Trusted Sources Found" value={claim.evidence.trustedSources} />
                <EvidenceStat
                  label="Direct Supporting Evidence"
                  value={claim.evidence.directSupporting}
                  highlight={claim.evidence.directSupporting === 0}
                />
              </div>
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                <ShieldCheck className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div>
                  <div className="font-medium">Result · Insufficient Evidence</div>
                  <div className="text-muted-foreground mt-1">{claim.evidence.missing}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Right column */}
          <div className="space-y-8">
            {/* Corrected claims */}
            <Card>
              <CardHeader icon={Sparkles} title="Corrected Claims" accent />
              <div className="mt-5 space-y-3">
                {claim.corrected.map((cc, i) => (
                  <details
                    key={i}
                    className="group rounded-2xl border border-border bg-white/[0.02] open:border-primary/30 open:bg-primary/[0.04] transition"
                    open={i === 0}
                  >
                    <summary className="cursor-pointer list-none p-5 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Original
                        </div>
                        <div className="mt-1 text-sm line-through decoration-destructive/60 text-muted-foreground">
                          {cc.original}
                        </div>
                        <div className="mt-3 text-[11px] uppercase tracking-wider text-primary">
                          Correction
                        </div>
                        <div className="mt-1 text-sm">{cc.correction}</div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground transition group-open:rotate-90 shrink-0" />
                    </summary>
                    <div className="px-5 pb-5 -mt-1 grid gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          Evidence strength
                        </span>
                        <StrengthBadge value={cc.evidenceStrength} />
                      </div>
                      <p className="text-muted-foreground leading-relaxed">{cc.explanation}</p>
                    </div>
                  </details>
                ))}
              </div>
            </Card>

            {/* Evolution */}
            <Card glow>
              <CardHeader icon={CheckCircle2} title="Claim Evolution" accent />
              <ol className="mt-6 relative space-y-6 before:absolute before:left-[15px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/60 before:via-secondary/40 before:to-transparent">
                {[
                  { k: "Original Claim", v: claim.originalClaims[0], tone: "destructive" as const },
                  { k: "CredLens Assessment", v: "Insufficient Evidence", tone: "muted" as const },
                  { k: "Expert Correction", v: claim.corrected[0]?.correction ?? "—", tone: "primary" as const },
                  { k: "Evidence Strength", v: claim.corrected[0]?.evidenceStrength ?? "—", tone: "secondary" as const },
                ].map((step, i) => (
                  <motion.li
                    key={i}
                    initial={{ opacity: 0, x: 12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.08 }}
                    className="relative pl-10"
                  >
                    <span
                      className={`absolute left-0 top-1 inline-flex h-8 w-8 items-center justify-center rounded-full border ${
                        step.tone === "primary"
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : step.tone === "secondary"
                          ? "bg-secondary/15 border-secondary/40 text-secondary"
                          : step.tone === "destructive"
                          ? "bg-destructive/15 border-destructive/40 text-destructive"
                          : "bg-white/5 border-border text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{step.k}</div>
                    <div className="mt-1 text-sm">{step.v}</div>
                  </motion.li>
                ))}
              </ol>
            </Card>

            {/* Sources */}
            <Card>
              <CardHeader icon={BookOpen} title="Sources" />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {claim.sources.map((s, i) => (
                  <a
                    key={i}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl border border-border bg-white/[0.02] p-4 hover:border-primary/40 transition flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="text-sm font-medium">{s.name}</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">{s.type}</div>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                  </a>
                ))}
              </div>
            </Card>
          </div>
        </div>

        {/* More claims */}
        <div className="mt-20">
          <h3 className="text-xl font-semibold tracking-tight mb-6">More from the archive</h3>
          <div className="grid gap-4 md:grid-cols-2">
            {others.map((o) => (
              <Link
                key={o.id}
                to="/claims/$claimId"
                params={{ claimId: o.id }}
                className="glass rounded-2xl p-5 hover:border-primary/40 transition flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">{o.domain}</div>
                  <div className="mt-1 text-sm font-medium">{o.centralClaim}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}

function Card({ children, glow = false }: { children: React.ReactNode; glow?: boolean }) {
  return (
    <div className={`glass rounded-3xl p-6 md:p-7 relative overflow-hidden ${glow ? "" : ""}`}>
      {glow && (
        <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-secondary/20 blur-3xl" />
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

function CardHeader({
  icon: Icon,
  title,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${
          accent ? "bg-gradient-to-br from-primary/25 to-secondary/20 text-primary" : "bg-white/5 text-muted-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
    </div>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5 border-b border-border/60 last:border-0">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{k}</span>
      <span className="text-sm text-right">{v}</span>
    </div>
  );
}

function EvidenceStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? "border-destructive/30 bg-destructive/5" : "border-border bg-white/[0.02]"
      }`}
    >
      <div className="font-display text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-[11px] uppercase tracking-wider text-muted-foreground leading-tight">
        {label}
      </div>
    </div>
  );
}

function StrengthBadge({ value }: { value: "Strong" | "Moderate" | "Limited" }) {
  const map = {
    Strong: "bg-primary/15 text-primary border-primary/30",
    Moderate: "bg-secondary/15 text-secondary border-secondary/30",
    Limited: "bg-white/5 text-muted-foreground border-border",
  } as const;
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[value]}`}>
      {value}
    </span>
  );
}

function MetricCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent?: "primary" | "secondary";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-3xl p-6 relative overflow-hidden"
    >
      <div
        className={`absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl ${
          accent === "primary" ? "bg-primary/25" : accent === "secondary" ? "bg-secondary/25" : "bg-white/5"
        }`}
      />
      <div className="relative">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="mt-3 font-display text-4xl font-semibold">{value}</div>
        <div className="mt-1 text-sm text-muted-foreground">{sub}</div>
      </div>
    </motion.div>
  );
}

