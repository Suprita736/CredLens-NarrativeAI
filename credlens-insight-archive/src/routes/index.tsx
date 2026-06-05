import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  FlaskConical,
  Inbox,
  Radar,
  Sparkles,
  Telescope,
} from "lucide-react";
import { SiteShell } from "@/components/site-shell";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CredLens — Understanding Narratives. Correcting Misinformation." },
      {
        name: "description",
        content:
          "CredLens is a public knowledge base of YouTube Shorts whose claims could not be verified automatically — reviewed, corrected, and sourced.",
      },
      { property: "og:title", content: "CredLens — Correcting misinformation, transparently." },
      {
        property: "og:description",
        content:
          "A research-grade archive of corrected misleading narratives, backed by evidence.",
      },
    ],
  }),
  loader: async () => {
    const { fetchClaims } = await import("@/lib/credlens-data");
    return fetchClaims();
  },
  component: Landing,
});

function Landing() {
  const claims = Route.useLoaderData();
  return (
    <SiteShell>
      <Hero />
      <HowItWorks />
      <Why />
      <Featured />
    </SiteShell>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 grid-bg" />
      <div className="absolute inset-0 pointer-events-none" style={{ background: "var(--gradient-hero)" }} />
      <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 md:pt-32 md:pb-36 text-center">
        <motion.div
          initial={false}
          className="inline-flex items-center gap-2 rounded-full glass px-3.5 py-1.5 text-xs text-muted-foreground mb-8"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
          Public knowledge base · v1 preview
        </motion.div>
        <motion.h1
          initial={false}
          className="text-5xl md:text-7xl font-semibold leading-[1.02] tracking-tight"
        >
          Understanding Narratives.
          <br />
          <span className="text-gradient">Correcting Misinformation.</span>
        </motion.h1>
        <motion.p
          initial={false}
          className="mx-auto mt-7 max-w-2xl text-base md:text-lg text-muted-foreground leading-relaxed"
        >
          CredLens identifies videos whose claims cannot be verified automatically, performs deeper
          evidence analysis, and publishes corrected information backed by reliable sources.
        </motion.p>
        <motion.div
          initial={false}
          className="mt-10 flex flex-wrap items-center justify-center gap-3"
        >
          <Link
            to="/claims/$claimId"
            params={{ claimId: "cl_001" }}
            className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground glow-accent hover:translate-y-[-1px] transition"
          >
            Explore Claims
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            to="/statistics"
            className="inline-flex items-center gap-2 rounded-full glass px-5 py-3 text-sm font-medium hover:border-primary/40 transition"
          >
            <BarChart3 className="h-4 w-4" />
            View Statistics
          </Link>
        </motion.div>

        <motion.div
          initial={false}
          className="mx-auto mt-20 grid max-w-3xl grid-cols-3 gap-4"
        >
          {[
            { k: "128", v: "Wrong claims logged" },
            { k: "92", v: "Corrections written" },
            { k: "42", v: "Videos covered" },
          ].map((m) => (
            <div key={m.v} className="glass rounded-2xl px-5 py-5 text-left">
              <div className="font-display text-3xl font-semibold">{m.k}</div>
              <div className="mt-1 text-xs text-muted-foreground">{m.v}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

const pipeline = [
  { icon: Radar, label: "Insufficient Evidence" },
  { icon: Inbox, label: "Queue" },
  { icon: Telescope, label: "Deep Research" },
  { icon: Sparkles, label: "Generate Correction" },
  { icon: CheckCircle2, label: "Publish" },
];

function HowItWorks() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Pipeline" title="How a claim becomes knowledge" />
      <div className="relative mt-14">
        <div className="hidden md:block absolute left-0 right-0 top-1/2 -translate-y-1/2 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <ul className="relative grid grid-cols-2 md:grid-cols-5 gap-4">
          {pipeline.map((step, i) => (
            <motion.li
              key={step.label}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass rounded-2xl p-5 flex flex-col items-start gap-3"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <step.icon className="h-4 w-4" />
              </span>
              <span className="text-xs uppercase tracking-wider text-muted-foreground">Step {i + 1}</span>
              <span className="text-sm font-medium">{step.label}</span>
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Why() {
  const items = [
    {
      icon: BookOpen,
      title: "Narrative Understanding",
      body: "We analyze the entire narrative instead of individual sentences, capturing intent and context.",
    },
    {
      icon: FlaskConical,
      title: "Deep Research",
      body: "Claims are reviewed using peer-reviewed evidence, expert sources, and scientific reasoning.",
    },
    {
      icon: BookOpen,
      title: "Public Knowledge Base",
      body: "Corrections become searchable, citable, and freely accessible to anyone.",
    },
  ];
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <SectionHeader eyebrow="Why CredLens exists" title="A research layer for the open web." />
      <div className="mt-14 grid gap-5 md:grid-cols-3">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55, delay: i * 0.08 }}
            whileHover={{ y: -4 }}
            className="glass rounded-3xl p-7 relative overflow-hidden"
          >
            <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-primary/20 blur-3xl opacity-40" />
            <div className="relative">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 text-primary">
                <it.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-5 text-lg font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function Featured() {
  const claims = Route.useLoaderData() as any[];
  return (
    <section className="mx-auto max-w-7xl px-6 py-20">
      <div className="flex items-end justify-between gap-4 mb-10">
        <SectionHeader eyebrow="Featured corrections" title="Recently reviewed claims" />
        <Link
          to="/claims/$claimId"
          params={{ claimId: "cl_001" }}
          className="hidden md:inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          Open archive <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {claims.map((c, i) => (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <Link
              to="/claims/$claimId"
              params={{ claimId: c.id }}
              className="group block glass rounded-3xl p-6 h-full hover:border-primary/40 transition"
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.domain}</span>
                <span className="text-xs rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                  {Math.round(c.confidence * 100)}% conf.
                </span>
              </div>
              <h3 className="text-base font-medium leading-snug">{c.centralClaim}</h3>
              <div className="mt-4 rounded-xl bg-white/[0.03] border border-border p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Verdict</div>
                <div className="text-sm">{c.verdict}</div>
              </div>
              <div className="mt-4 rounded-xl bg-white/[0.03] border border-border p-4">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Correction preview</div>
                <div className="text-sm text-muted-foreground line-clamp-3">{c.corrected[0]?.correction}</div>
              </div>
              <div className="mt-5 inline-flex items-center gap-1 text-sm text-primary group-hover:gap-2 transition-all">
                Open claim <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}

function SectionHeader({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <div className="text-xs uppercase tracking-[0.18em] text-primary/80">{eyebrow}</div>
      <h2 className="mt-3 text-3xl md:text-4xl font-semibold tracking-tight">{title}</h2>
    </div>
  );
}
