import { useState, useEffect } from "react";
import {
  Shield,
  Key,
  Check,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  BookOpen,
  Newspaper,
  Search,
  Info,
} from "lucide-react";

const App = () => {
  const [geminiKey, setGeminiKey] = useState("");
  const [openRouterKey, setOpenRouterKey] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    chrome.storage.local.get(["geminiApiKey", "openRouterApiKey"], (result: { [key: string]: any }) => {
      if (result.geminiApiKey) setGeminiKey(result.geminiApiKey);
      if (result.openRouterApiKey) setOpenRouterKey(result.openRouterApiKey);
    });
  }, []);

  const saveApiKeys = () => {
    const trimmedGemini = geminiKey.trim();
    const trimmedOpenRouter = openRouterKey.trim();

    if (trimmedGemini && !trimmedGemini.startsWith("AIza")) {
      setError("Invalid Gemini key format. It should start with AIza…");
      return;
    }

    chrome.storage.local.set(
      {
        geminiApiKey: trimmedGemini,
        openRouterApiKey: trimmedOpenRouter,
      },
      () => {
        setSaved(true);
        setError("");
        setTimeout(() => setSaved(false), 3000);
      }
    );
  };

  const features = [
    {
      icon: <Search size={12} className="text-blue-400" />,
      label: "Fact Check Verification",
      detail: "Live fact-check database lookup (via Gemini Key)",
    },
    {
      icon: <BookOpen size={12} className="text-emerald-400" />,
      label: "PubMed / NCBI Research",
      detail: "Category-aware health/science papers (free)",
    },
    {
      icon: <Newspaper size={12} className="text-violet-400" />,
      label: "Google News RSS",
      detail: "Politics/news/finance reports (free)",
    },
    {
      icon: <Zap size={12} className="text-amber-400" />,
      label: "Narrative Synthesis Engine",
      detail: "Gemini / OpenRouter GPT-4o-mini",
    },
    {
      icon: <Shield size={12} className="text-indigo-400" />,
      label: "Verifiability Filter",
      detail: "Zero-cost local heuristic filters & cache",
    },
  ];

  return (
    <div className="w-80 bg-slate-950 text-white min-h-[460px] flex flex-col font-sans antialiased">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-slate-900 flex items-center gap-3">
        <div className="p-2 bg-gradient-to-br from-blue-600 to-violet-600 rounded-xl shadow-lg shadow-blue-900/30">
          <Shield size={20} />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold tracking-tight leading-none">CredLens AI</h1>
          <p className="text-[10px] text-slate-400 mt-0.5">YouTube Shorts Fact Verifier</p>
        </div>
      </div>

      {/* Body */}
      <div className="flex-grow px-5 py-4 space-y-4">
        {/* Gemini API Key Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Gemini API Key
          </label>
          <div className="relative">
            <input
              id="gemini-api-key-input"
              type="password"
              value={geminiKey}
              onChange={(e) => {
                setGeminiKey(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && saveApiKeys()}
              placeholder="AIza…"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-600"
            />
            <Key className="absolute left-3 top-2.5 text-slate-600" size={14} />
          </div>
        </div>

        {/* OpenRouter API Key Input */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            OpenRouter API Key
          </label>
          <div className="relative">
            <input
              id="openrouter-api-key-input"
              type="password"
              value={openRouterKey}
              onChange={(e) => {
                setOpenRouterKey(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && saveApiKeys()}
              placeholder="sk-or-…"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-600"
            />
            <Key className="absolute left-3 top-2.5 text-slate-600" size={14} />
          </div>
          {error && (
            <div className="flex items-center gap-1.5 text-rose-400 text-[10px] mt-1">
              <AlertCircle size={11} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Save Button */}
        <button
          id="save-api-key-btn"
          onClick={saveApiKeys}
          className={`
            w-full py-2 rounded-lg font-semibold text-sm transition-all flex items-center justify-center gap-2
            ${
              saved
                ? "bg-emerald-700 border border-emerald-600 text-emerald-100"
                : "bg-blue-600 hover:bg-blue-500 active:scale-95 text-white"
            }
          `}
        >
          {saved ? (
            <>
              <Check size={14} />
              Keys Saved
            </>
          ) : (
            "Save API Keys"
          )}
        </button>

        {/* Feature List Toggle */}
        <div className="border border-slate-900 rounded-xl overflow-hidden">
          <button
            id="toggle-feature-list"
            onClick={() => setShowTips((v) => !v)}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-semibold text-slate-300 hover:bg-slate-900 transition-colors"
          >
            <span className="flex items-center gap-1.5">
              <Info size={11} className="text-slate-500" />
              System Capabilities
            </span>
            {showTips ? (
              <ChevronUp size={11} className="text-slate-500" />
            ) : (
              <ChevronDown size={11} className="text-slate-500" />
            )}
          </button>

          {showTips && (
            <div className="px-3 pb-3 space-y-2 border-t border-slate-900 pt-2">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-0.5 shrink-0">{f.icon}</div>
                  <div>
                    <p className="text-[10px] font-semibold text-slate-200">
                      {f.label}
                    </p>
                    <p className="text-[9px] text-slate-500">{f.detail}</p>
                  </div>
                </div>
              ))}

              <div className="mt-2 pt-2 border-t border-slate-900 text-[9px] text-slate-500 leading-relaxed">
                <span className="font-bold text-amber-400">Note:</span> If API keys
                are missing or exhausted, CredLens runs local synthesis using
                retrieved evidence. Fact Check Tools API requires a Gemini Key.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-4 pt-2 border-t border-slate-900">
        <p className="text-[9px] text-slate-600 text-center leading-relaxed">
          CredLens AI · Retrieval-First, LLM-Last-Resort.
          Dynamic category-routing and local verifiability filter.
        </p>
      </div>
    </div>
  );
};

export default App;
