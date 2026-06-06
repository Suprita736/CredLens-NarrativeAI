import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Inbox } from "lucide-react";
import { SiteShell } from "@/components/site-shell";

export const Route = createFileRoute("/claims/")({
  loader: async () => {
    const { fetchClaims } = await import("@/lib/credlens-data");
    return fetchClaims();
  },
  component: ClaimsIndex,
});

function ClaimsIndex() {
  const claims = Route.useLoaderData();

  return (
    <SiteShell>
      <div className="relative mx-auto max-w-7xl px-6 pt-12 pb-20">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-[0.18em] text-primary/80">Archive</div>
          <h1 className="mt-3 text-4xl md:text-5xl font-semibold tracking-tight">Verified Claims</h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            A comprehensive list of narratives analyzed and corrected by CredLens.
          </p>
        </div>

        {claims.length === 0 ? (
          <div className="mt-16 glass rounded-3xl p-16 text-center max-w-2xl mx-auto">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-muted-foreground mb-6">
              <Inbox className="h-8 w-8" />
            </div>
            <h3 className="text-2xl font-medium tracking-tight">No analyzed claims yet.</h3>
            <p className="mt-3 text-base text-muted-foreground leading-relaxed">
              Once CredLens analyzes videos and logs claims to Supabase, they will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 md:grid-cols-3">
            {claims.map((c, i) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05 }}
              >
                <Link
                  to={`/claims/$claimId`}
                  params={{ claimId: c.id }}
                  className="group block glass rounded-3xl p-6 h-full hover:border-primary/40 transition flex flex-col"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground">{c.domain}</span>
                    <span className="text-xs rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                      {Math.round(c.confidence)}% conf.
                    </span>
                  </div>
                  <h3 className="text-base font-medium leading-snug">{c.centralClaim}</h3>
                  
                  <div className="mt-auto pt-4 space-y-4">
                    <div className="rounded-xl bg-white/[0.03] border border-border p-4">
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">Verdict</div>
                      <div className="text-sm">{c.verdict}</div>
                    </div>
                    
                    <div className="mt-5 inline-flex items-center justify-between w-full text-sm text-primary group-hover:gap-2 transition-all">
                      <span className="text-xs text-muted-foreground">
                        {new Date(c.detectedAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1 group-hover:gap-2 transition-all">
                        Open claim <ArrowRight className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </SiteShell>
  );
}
