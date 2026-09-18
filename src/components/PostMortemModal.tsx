import React, { useState } from "react";
import { X, Copy, Check, Download, FileText, Sparkles, Loader2 } from "lucide-react";

interface PostMortemModalProps {
  isOpen: boolean;
  incidentId: string | null;
  markdown: string | null;
  isLoading: boolean;
  onClose: () => void;
  onRegenerate: () => void;
}

export function PostMortemModal({
  isOpen,
  incidentId,
  markdown,
  isLoading,
  onClose,
  onRegenerate,
}: PostMortemModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!markdown || !incidentId) return;
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `PostMortem-${incidentId}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-3xl rounded-xl border border-slate-800 bg-slate-950 p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-950/80 border border-indigo-700/60">
              <FileText className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white text-base">Blameless Post-Mortem Report</h3>
                <span className="font-mono text-xs text-cyan-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                  {incidentId}
                </span>
              </div>
              <p className="text-xs text-slate-400">Synthesized with Gemini 3.8 Flash automated SRE report generator</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleCopy}
              disabled={!markdown || isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition"
              title="Copy Markdown to clipboard"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? "Copied" : "Copy"}</span>
            </button>

            <button
              onClick={handleDownload}
              disabled={!markdown || isLoading}
              className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 hover:text-white disabled:opacity-50 transition"
              title="Download as .md file"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition ml-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4 font-mono text-xs leading-relaxed text-slate-300">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
              <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
              <p className="text-sm text-slate-300 font-sans">
                Gemini 3.8 Flash is drafting the root cause analysis, SLO impact, and Five Whys...
              </p>
            </div>
          ) : markdown ? (
            <div className="rounded-lg bg-slate-900/60 border border-slate-800/80 p-4 font-sans text-xs space-y-2 whitespace-pre-wrap">
              {markdown}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 font-sans">
              No report data available. Click regenerate to synthesize a post-mortem.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Formatted in standard GitHub/Google Cloud SRE Post-Mortem template.</span>
          <button
            onClick={onRegenerate}
            disabled={isLoading}
            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Re-synthesize with Gemini</span>
          </button>
        </div>
      </div>
    </div>
  );
}
