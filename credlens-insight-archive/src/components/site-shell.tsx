import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import type { ReactNode } from "react";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  return (
    <motion.header
      initial={false}
      className="sticky top-0 z-50"
    >
      <div className="glass border-b border-border/60">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 group">
            <span className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/90 to-secondary/90 glow-accent">
              <Activity className="h-4 w-4 text-background" strokeWidth={2.5} />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight">
              CredLens
              <span className="text-muted-foreground font-normal"> / Knowledge Base</span>
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-1 text-sm">
            <Link to="/" className="px-3.5 py-2 rounded-full text-muted-foreground hover:text-foreground transition data-[status=active]:text-foreground" activeProps={{ className: "bg-white/5" }}>Home</Link>
            <Link to="/claims/$claimId" params={{ claimId: "cl_001" }} className="px-3.5 py-2 rounded-full text-muted-foreground hover:text-foreground transition data-[status=active]:text-foreground" activeProps={{ className: "bg-white/5" }}>Claims</Link>
            <Link to="/statistics" className="px-3.5 py-2 rounded-full text-muted-foreground hover:text-foreground transition data-[status=active]:text-foreground" activeProps={{ className: "bg-white/5" }}>Statistics</Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="ml-3 inline-flex items-center rounded-full border border-border/80 px-3.5 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
            >
              GitHub
            </a>
          </nav>
        </div>
      </div>
    </motion.header>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border/60 mt-24">
      <div className="mx-auto max-w-7xl px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} CredLens — Public misinformation archive.</p>
        <div className="flex items-center gap-6">
          <Link to="/claims/$claimId" params={{ claimId: "cl_001" }} className="hover:text-foreground">Claims</Link>
          <Link to="/statistics" className="hover:text-foreground">Statistics</Link>
          <a href="https://github.com" target="_blank" rel="noreferrer" className="hover:text-foreground">GitHub</a>
        </div>
      </div>
    </footer>
  );
}
