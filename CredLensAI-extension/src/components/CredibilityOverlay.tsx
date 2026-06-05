import React, { useState } from "react";
import type { NarrativeAnalysis, ResearchArticle, NewsArticle } from "../types";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  X,
  BookOpen,
  Newspaper,
  Sparkles,
  Info
} from "lucide-react";

interface Props {
  analysis: NarrativeAnalysis;
  onClose: () => void;
}

const CredibilityOverlay: React.FC<Props> = ({ analysis, onClose }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (analysis.isSatire) {
    // Elegant small indicator for Satire to not disrupt comedy videos
    return (
      <div className="flex items-center gap-2 p-2 bg-indigo-950/80 backdrop-blur-md border border-indigo-800/50 rounded-xl shadow-lg text-indigo-200 select-none animate-in fade-in slide-in-from-top-2 text-xs">
        <Sparkles size={14} className="animate-pulse text-indigo-400" />
        <span className="font-semibold uppercase tracking-wider">Satirical Content</span>
        <button
          onClick={onClose}
          className="ml-2 p-0.5 hover:bg-indigo-900/50 rounded-full transition-colors"
        >
          <X size={10} />
        </button>
      </div>
    );
  }

  // Get dynamic styles based on verdict (new 4-verdict system)
  const getVerdictConfig = () => {
    switch (analysis.verdict) {
      case "Supported":
        return {
          glow: "shadow-[0_0_15px_rgba(16,185,129,0.2)]",
          border: "border-emerald-500/30 hover:border-emerald-500/50",
          bg: "bg-emerald-950/85",
          pillBg: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
          text: "text-emerald-300",
          icon: <ShieldCheck className="text-emerald-400 shrink-0" size={18} />,
          badgeText: "Supported",
          gaugeColor: "#10b981",
        };
      case "Exaggerated":
        return {
          glow: "shadow-[0_0_15px_rgba(245,158,11,0.2)]",
          border: "border-amber-500/30 hover:border-amber-500/50",
          bg: "bg-amber-950/85",
          pillBg: "bg-amber-500/20 text-amber-300 border-amber-500/40",
          text: "text-amber-300",
          icon: <ShieldAlert className="text-amber-400 shrink-0" size={18} />,
          badgeText: "Exaggerated",
          gaugeColor: "#f59e0b",
        };
      case "Misleading":
        return {
          glow: "shadow-[0_0_15px_rgba(239,68,68,0.25)]",
          border: "border-rose-500/30 hover:border-rose-500/50",
          bg: "bg-rose-950/85",
          pillBg: "bg-rose-500/20 text-rose-300 border-rose-500/40",
          text: "text-rose-300",
          icon: <ShieldX className="text-rose-400 shrink-0" size={18} />,
          badgeText: "Misleading",
          gaugeColor: "#f43f5e",
        };
      case "Insufficient Evidence":
      default:
        return {
          glow: "shadow-[0_0_15px_rgba(148,163,184,0.15)]",
          border: "border-slate-700/50 hover:border-slate-600/70",
          bg: "bg-slate-900/85",
          pillBg: "bg-slate-800 text-slate-300 border-slate-700",
          text: "text-slate-300",
          icon: <Shield className="text-slate-400 shrink-0" size={18} />,
          badgeText: "Insufficient Evidence",
          gaugeColor: "#94a3b8",
        };
    }
  };

  const config = getVerdictConfig();
  const hasSources =
    (analysis.factCheck?.url) ||
    (analysis.healthResearch?.sources && analysis.healthResearch.sources.length > 0) ||
    (analysis.newsVerification?.sources && analysis.newsVerification.sources.length > 0);

  // Helper: color for confidence axis bar
  const axisColor = (value: number, max: number): string => {
    const ratio = value / max;
    if (ratio >= 0.7) return "bg-emerald-400";
    if (ratio >= 0.4) return "bg-amber-400";
    return "bg-rose-400";
  };

  return (
    <div className="font-sans antialiased select-none pointer-events-auto">
      {!isExpanded ? (
        // COMPACT Badged Pill View
        <div
          onClick={() => setIsExpanded(true)}
          className={`
            flex items-center gap-2.5 px-3.5 py-2.5 rounded-full backdrop-blur-lg border transition-all duration-300 cursor-pointer
            ${config.bg} ${config.border} ${config.glow} text-white hover:scale-105 active:scale-95 animate-in fade-in slide-in-from-top-4
          `}
        >
          {config.icon}
          <div className="flex flex-col pr-1">
            <span className="text-[9px] uppercase tracking-widest text-slate-400 font-bold leading-none">
              CredLens AI
            </span>
            <span className="text-xs font-semibold leading-tight mt-0.5">
              {analysis.verdict || "Analyzing..."}
            </span>
          </div>
          <ChevronDown size={14} className="text-slate-400 hover:text-white transition-colors ml-1 shrink-0" />
        </div>
      ) : (
        // EXPANDED Dashboard View
        <div
          className={`
            w-96 p-5 rounded-2xl backdrop-blur-xl border border-slate-800/80 bg-slate-950/90 text-white shadow-2xl 
            transition-all duration-300 animate-in fade-in zoom-in-95 ${config.glow}
          `}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-slate-900 rounded-lg">
                {config.icon}
              </div>
              <div>
                <h3 className="text-sm font-bold tracking-tight">CredLens Fact Check</h3>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold mt-0.5">
                  Narrative Synthesis AI
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-1">
              <button
                onClick={onClose}
                className="p-1 hover:bg-slate-900 rounded-full transition-colors text-slate-400 hover:text-white"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Central Claim */}
          {analysis.centralClaim && (
            <div className="mb-4 bg-slate-900/50 border border-slate-900 p-3 rounded-xl">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                Central Claim
              </span>
              <p className="text-xs text-slate-300 mt-1 italic font-medium leading-relaxed">
                "{analysis.centralClaim}"
              </p>
              {analysis.claimDomain && (
                <span className="inline-block mt-1.5 text-[8px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 uppercase tracking-wider font-bold">
                  {analysis.claimDomain}
                </span>
              )}
            </div>
          )}

          {/* Credibility & Verdict Meter */}
          <div className="flex gap-4 mb-4 items-center bg-slate-900/20 p-3 rounded-xl border border-slate-900">
            {/* Circular Progress Gauge */}
            <div className="relative flex items-center justify-center shrink-0">
              <svg className="w-14 h-14 transform -rotate-90">
                <circle
                  cx="28"
                  cy="28"
                  r="23"
                  className="stroke-slate-800"
                  strokeWidth="4"
                  fill="transparent"
                />
                <circle
                  cx="28"
                  cy="28"
                  r="23"
                  className="stroke-current transition-all duration-1000 ease-out"
                  strokeWidth="4"
                  fill="transparent"
                  strokeDasharray={144.5}
                  strokeDashoffset={144.5 - (144.5 * (analysis.confidence || 0)) / 100}
                  strokeLinecap="round"
                  style={{ color: config.gaugeColor }}
                />
              </svg>
              <span className="absolute text-[11px] font-bold">
                {analysis.confidence || 0}
              </span>
            </div>

            <div className="flex-grow">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 leading-none">
                Confidence Score
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-bold ${config.text}`}>
                  {analysis.verdict || "Analyzing"}
                </span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border uppercase tracking-wider leading-none ${config.pillBg}`}>
                  {config.badgeText}
                </span>
              </div>
            </div>
          </div>

          {/* 4-Axis Confidence Breakdown */}
          {analysis.confidenceBreakdown && (
            <div className="mb-4 p-3 rounded-xl bg-slate-900/40 border border-slate-900 space-y-2">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                Confidence Breakdown
              </span>
              {/* Source Authority */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-slate-400 font-semibold w-20 shrink-0 uppercase tracking-wider">Authority</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${axisColor(analysis.confidenceBreakdown.sourceAuthority, 30)}`}
                    style={{ width: `${(analysis.confidenceBreakdown.sourceAuthority / 30) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300 w-8 text-right">{analysis.confidenceBreakdown.sourceAuthority}/30</span>
              </div>
              {/* Evidence Relevance */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-slate-400 font-semibold w-20 shrink-0 uppercase tracking-wider">Relevance</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${axisColor(analysis.confidenceBreakdown.evidenceRelevance, 30)}`}
                    style={{ width: `${(analysis.confidenceBreakdown.evidenceRelevance / 30) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300 w-8 text-right">{analysis.confidenceBreakdown.evidenceRelevance}/30</span>
              </div>
              {/* Hedging Level */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-slate-400 font-semibold w-20 shrink-0 uppercase tracking-wider">Hedging</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${axisColor(analysis.confidenceBreakdown.hedgingLevel, 20)}`}
                    style={{ width: `${(analysis.confidenceBreakdown.hedgingLevel / 20) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300 w-8 text-right">{analysis.confidenceBreakdown.hedgingLevel}/20</span>
              </div>
              {/* Multi-source Corroboration */}
              <div className="flex items-center gap-2">
                <span className="text-[8px] text-slate-400 font-semibold w-20 shrink-0 uppercase tracking-wider">Sources</span>
                <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${axisColor(analysis.confidenceBreakdown.multiSourceCorroboration, 20)}`}
                    style={{ width: `${(analysis.confidenceBreakdown.multiSourceCorroboration / 20) * 100}%` }}
                  />
                </div>
                <span className="text-[9px] font-bold text-slate-300 w-8 text-right">{analysis.confidenceBreakdown.multiSourceCorroboration}/20</span>
              </div>
            </div>
          )}

          {/* Narrative Summary */}
          {analysis.narrativeSummary && (
            <div className="mb-4 bg-slate-900/30 border border-slate-900 p-3 rounded-xl">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                Narrative Summary
              </span>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed font-medium">
                {analysis.narrativeSummary}
              </p>
            </div>
          )}

          {/* Supporting Claims */}
          {analysis.supportingClaims && analysis.supportingClaims.length > 0 && (
            <div className="mb-4">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                Supporting Claims
              </span>
              <ul className="mt-1.5 space-y-1">
                {analysis.supportingClaims.map((claim, idx) => (
                  <li key={idx} className="text-[10px] text-slate-400 leading-relaxed pl-2 border-l-2 border-slate-800">
                    {claim}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Context */}
          {analysis.context && (
            <div className="mb-4 pt-1.5 border-t border-slate-900">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500">
                Context
              </span>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                {analysis.context}
              </p>
            </div>
          )}

          {/* Outbound Citations & Evidence Sources */}
          {hasSources && (
            <div className="mt-4 border-t border-slate-900 pt-3">
              <span className="text-[9px] uppercase tracking-wider font-bold text-slate-500 flex items-center gap-1">
                <BookOpen size={10} />
                External Supporting Evidence
              </span>
              
              <div className="mt-2 space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                {/* 1. Fact-Check Citations */}
                {analysis.factCheck?.url && (
                  <a
                    href={analysis.factCheck.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 p-2 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-900 transition-colors text-slate-300 hover:text-white"
                  >
                    <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                    <div className="flex-grow min-w-0">
                      <p className="text-[10px] font-semibold truncate">
                        {analysis.factCheck.explanation}
                      </p>
                      <p className="text-[8px] text-slate-500 mt-0.5 flex items-center gap-1">
                        <span>Database Review by {analysis.factCheck.source}</span>
                        <ExternalLink size={8} />
                      </p>
                    </div>
                  </a>
                )}

                {/* 2. Medical Research Citations */}
                {analysis.healthResearch?.sources &&
                  analysis.healthResearch.sources.map((art: ResearchArticle, idx: number) => (
                    <a
                      key={`health-${idx}`}
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-900 transition-colors text-slate-300 hover:text-white"
                    >
                      <BookOpen size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-grow min-w-0">
                        <p className="text-[10px] font-semibold truncate">
                          {art.title.replace(/\.$/, "")}
                        </p>
                        <p className="text-[8px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span>{art.journal} ({art.date.split(" ")[0]})</span>
                          <ExternalLink size={8} />
                        </p>
                      </div>
                    </a>
                  ))}

                {/* 3. News Grounding Citations */}
                {analysis.newsVerification?.sources &&
                  analysis.newsVerification.sources.map((art: NewsArticle, idx: number) => (
                    <a
                      key={`news-${idx}`}
                      href={art.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 p-2 bg-slate-900/50 hover:bg-slate-900 rounded-lg border border-slate-900 transition-colors text-slate-300 hover:text-white"
                    >
                      <Newspaper size={14} className="text-blue-400 shrink-0 mt-0.5" />
                      <div className="flex-grow min-w-0">
                        <p className="text-[10px] font-semibold truncate text-left">
                          {art.title}
                        </p>
                        <p className="text-[8px] text-slate-500 mt-0.5 flex items-center gap-1">
                          <span>{art.source}</span>
                          <ExternalLink size={8} />
                        </p>
                      </div>
                    </a>
                  ))}
              </div>
            </div>
          )}

          {/* Footer Action */}
          <div className="mt-4 border-t border-slate-900 pt-3 flex items-center justify-between text-[9px] text-slate-500 font-medium">
            <span>Verified at {new Date().toLocaleDateString()}</span>
            <button
              onClick={() => setIsExpanded(false)}
              className="text-slate-400 hover:text-white flex items-center gap-0.5 py-0.5 px-1.5 hover:bg-slate-900 rounded transition-colors"
            >
              <span>Collapse Panel</span>
              <ChevronUp size={10} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CredibilityOverlay;
