import React, { useState, useRef, useEffect } from "react";
import { X, Send, Bot, User, Sparkles, Terminal, Copy, Check, RefreshCw } from "lucide-react";
import { AiCopilotMessage, Incident } from "../types";

interface AiCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeIncident: Incident | null;
}

const QUICK_PROMPTS = [
  "Why did latency spike on the database?",
  "What is the estimated blast radius?",
  "Draft a Slack incident alert for leadership.",
  "What shell commands verify the pod health?",
];

export function AiCopilotDrawer({ isOpen, onClose, activeIncident }: AiCopilotDrawerProps) {
  const [messages, setMessages] = useState<AiCopilotMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello, I am **OpsGuard Copilot**, an SRE intelligence assistant connected to your live infrastructure cluster. Ask me anything about telemetry anomalies, blast radiuses, root causes, or runbook execution.",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);

  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const handleSend = async (userText: string) => {
    if (!userText.trim() || isLoading) return;

    const userMsg: AiCopilotMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: userText.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userText,
          contextIncidentId: activeIncident?.id,
        }),
      });
      const data = await res.json();

      const aiMsg: AiCopilotMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: data.reply || "No response received.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `⚠️ Failed to connect to Gemini SRE service: ${err?.message || "Unknown error"}`,
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col bg-slate-950 border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3.5 bg-slate-900/60">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-md shadow-cyan-500/20">
            <Bot className="h-4 w-4 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-semibold text-white">OpsGuard Copilot</h3>
              <span className="rounded bg-cyan-950/80 border border-cyan-800/60 px-1.5 py-0.2 text-[10px] font-mono text-cyan-300">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-slate-400">Context-aware infrastructure assistant</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages Feed */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}>
              {!isUser && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
                  <Bot className="h-3.5 w-3.5" />
                </div>
              )}

              <div
                className={`max-w-[85%] rounded-xl p-3 text-xs leading-relaxed space-y-1.5 ${
                  isUser
                    ? "bg-cyan-600 text-white rounded-br-none"
                    : "bg-slate-900 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm"
                }`}
              >
                <div className="flex items-center justify-between gap-4 text-[10px] opacity-70">
                  <span>{isUser ? "You" : "OpsGuard AI"}</span>
                  <div className="flex items-center gap-1">
                    <span>{m.timestamp}</span>
                    {!isUser && (
                      <button
                        onClick={() => copyToClipboard(m.content, m.id)}
                        className="hover:text-white p-0.5"
                        title="Copy text"
                      >
                        {copiedId === m.id ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                      </button>
                    )}
                  </div>
                </div>

                <div className="whitespace-pre-wrap font-sans break-words">{m.content}</div>
              </div>

              {isUser && (
                <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300">
                  <User className="h-3.5 w-3.5" />
                </div>
              )}
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-2.5 items-center text-xs text-slate-400">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-950/80 border border-cyan-800 text-cyan-400">
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            </div>
            <div className="rounded-xl bg-slate-900 border border-slate-800 px-3 py-2">
              <span>OpsGuard Copilot is querying cluster state and synthesizing SRE response...</span>
            </div>
          </div>
        )}
      </div>

      {/* Suggested Quick Prompts */}
      <div className="border-t border-slate-800/80 bg-slate-950 px-3 py-2">
        <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mb-1.5">
          Suggested Prompts
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((qp, i) => (
            <button
              key={i}
              onClick={() => handleSend(qp)}
              disabled={isLoading}
              className="text-[11px] rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-300 hover:border-cyan-500 hover:text-cyan-300 transition"
            >
              {qp}
            </button>
          ))}
        </div>
      </div>

      {/* Input area */}
      <div className="border-t border-slate-800 p-3 bg-slate-900/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend(input);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Copilot about telemetry, blast radius, runbooks..."
            className="flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 font-sans"
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="rounded-lg bg-cyan-500 p-2 text-slate-950 hover:bg-cyan-400 disabled:opacity-50 transition"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
