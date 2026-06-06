import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, CheckCircle2, Film, Sparkles } from "lucide-react";
import { SiteShell } from "@/components/site-shell";


export const Route = createFileRoute("/statistics")({
  head: () => ({
    meta: [
      { title: "Statistics — CredLens" },
      {
        name: "description",
        content: "Live trends, domains, and top misinformation patterns tracked by CredLens.",
      },
      { property: "og:title", content: "CredLens Statistics" },
      {
        property: "og:description",
        content: "Open data on misinformation trends across domains.",
      },
    ],
  }),
  loader: async () => {
    const { fetchStats } = await import("@/lib/credlens-data");
    return fetchStats();
  },
  component: StatisticsPage,
});

const PIE_COLORS = [
  "oklch(0.86 0.22 158)",
  "oklch(0.66 0.21 258)",
  "oklch(0.78 0.15 200)",
  "oklch(0.72 0.18 300)",
  "oklch(0.78 0.18 60)",
  "oklch(0.7 0.18 20)",
];

function StatisticsPage() {
  const stats = Route.useLoaderData() as Awaited<ReturnType<typeof import("@/lib/credlens-data").fetchStats>>;
  return (
    <SiteShell>
      <div className="relative mx-auto max-w-7xl px-6 pt-12 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="text-xs uppercase tracking-[0.18em] text-primary/80">Live</div>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">Misinformation Trends</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A real-time view of the videos CredLens couldn't verify automatically — and what we corrected.
          </p>
        </motion.div>

        {stats.overview.wrongClaimsLogged === 0 ? (
          <div className="mt-16 glass rounded-3xl p-16 text-center max-w-2xl mx-auto">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground mb-6">
              <Activity className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-medium tracking-tight">No statistics available yet.</h3>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              Once CredLens analyzes videos and logs claims to Supabase, this dashboard will automatically populate with live trends, domain distributions, and correction metrics.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-10 grid gap-4 md:grid-cols-4">
          <Overview icon={Activity} label="Wrong claims today" value={stats.overview.wrongClaimsToday} accent="primary" />
          <Overview icon={Film} label="Videos reviewed today" value={stats.overview.videosReviewedToday} />
          <Overview
            icon={CheckCircle2}
            label="Corrections published today"
            value={stats.overview.correctionsPublishedToday}
            accent="secondary"
          />
          <Overview icon={Sparkles} label="Most active domain" value={stats.overview.mostActiveDomain} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Wrong claims per day" subtitle="Last 30 days">
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.daily} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradA" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.86 0.22 158)" stopOpacity={0.55} />
                      <stop offset="100%" stopColor="oklch(0.86 0.22 158)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "oklch(0.72 0.025 255)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "oklch(0.72 0.025 255)", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.235 0.03 262)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: 12,
                      color: "white",
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="claims"
                    stroke="oklch(0.86 0.22 158)"
                    strokeWidth={2}
                    fill="url(#gradA)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="Domain distribution" subtitle="All-time">
            <div className="h-72 flex items-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.domains}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={62}
                    outerRadius={100}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {stats.domains.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.235 0.03 262)",
                      border: "1px solid oklch(1 0 0 / 0.1)",
                      borderRadius: 12,
                      color: "white",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {stats.domains.map((d, i) => (
                <div key={d.name} className="flex items-center gap-2 text-muted-foreground">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-foreground">{d.name}</span>
                  <span className="ml-auto">{d.value}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
          <Panel title="Most repeated claims" subtitle="Across the archive">
            <div className="mt-2 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="text-left font-normal px-4 py-3">Claim</th>
                    <th className="text-left font-normal px-4 py-3">Occurrences</th>
                    <th className="text-left font-normal px-4 py-3">Domain</th>
                    <th className="text-left font-normal px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.topClaims.map((c, i) => (
                    <tr key={i} className="border-t border-border/60 hover:bg-white/[0.02]">
                      <td className="px-4 py-3">{c.claim}</td>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs text-primary">{c.occurrences}</span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{c.domain}</td>
                      <td className="px-4 py-3">
                        <StatusPill status={c.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>

          <Panel title="Recent corrections" subtitle="Newest first">
            <ol className="mt-3 relative space-y-5 before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-primary/50 before:to-transparent">
              {stats.recent.map((r, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="relative pl-8"
                >
                  <span className="absolute left-0 top-1.5 h-5 w-5 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                  </span>
                  <div className="text-sm font-medium">{r.title}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {r.time} · {r.domain}
                  </div>
                </motion.li>
              ))}
            </ol>
          </Panel>
        </div>
        </>
        )}
      </div>
    </SiteShell>
  );
}

function Overview({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  accent?: "primary" | "secondary";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45 }}
      className="glass rounded-2xl p-5 relative overflow-hidden"
    >
      <div
        className={`absolute -top-16 -right-16 h-32 w-32 rounded-full blur-3xl ${
          accent === "primary" ? "bg-primary/25" : accent === "secondary" ? "bg-secondary/25" : "bg-white/5"
        }`}
      />
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="mt-3 font-display text-3xl font-semibold">{value}</div>
      </div>
    </motion.div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="glass rounded-3xl p-6"
    >
      <div className="flex items-end justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
          {subtitle && <div className="text-xs text-muted-foreground mt-0.5">{subtitle}</div>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    Published: "bg-primary/15 text-primary border-primary/30",
    Reviewed: "bg-secondary/15 text-secondary border-secondary/30",
    Pending: "bg-white/5 text-muted-foreground border-border",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[status] ?? map.Pending}`}>
      {status}
    </span>
  );
}
