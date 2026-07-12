import React from 'react';
import { Download } from 'lucide-react';

export default function PrivacyControls({
  redactSensitiveData,
  handleToggleRedact,
  aggregateOnlyMode,
  handleToggleAggregateOnly,
  setChatLog,
  showSharedContext,
  setShowSharedContext,
  financialContext
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-obsidian-850/60 p-3 rounded-2xl border border-obsidian-800/80 text-xs shrink-0">
      <div className="flex items-center gap-4 flex-wrap">
        <label className="flex items-center space-x-2 text-slate-350 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={redactSensitiveData}
            onChange={(e) => handleToggleRedact(e.target.checked)}
            className="rounded border-slate-700 text-neon-indigo focus:ring-neon-indigo bg-obsidian-800 w-3.5 h-3.5 cursor-pointer"
          />
          <span>Redact Sensitive Details</span>
        </label>
        
        <label className="flex items-center space-x-2 text-slate-350 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={aggregateOnlyMode}
            onChange={(e) => handleToggleAggregateOnly(e.target.checked)}
            className="rounded border-slate-700 text-neon-indigo focus:ring-neon-indigo bg-obsidian-800 w-3.5 h-3.5 cursor-pointer"
          />
          <span>Limit to Aggregates</span>
        </label>
      </div>

      <div className="flex items-center space-x-2">
        <button
          type="button"
          onClick={() => {
            setChatLog([
              {
                role: 'model',
                content: "Hello! I'm your FinFlow Copilot. I have access to your account balances, budgets, and transaction history. Ask me anything!"
              }
            ]);
          }}
          className="text-[10px] font-bold text-slate-400 hover:text-white px-2.5 py-1.5 bg-obsidian-800 rounded-lg border border-obsidian-750 transition-all cursor-pointer focus:outline-none"
        >
          Clear Chat
        </button>

        <button
          type="button"
          onClick={() => setShowSharedContext(!showSharedContext)}
          className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 hover:text-white px-2.5 py-1.5 bg-obsidian-800 rounded-lg border border-obsidian-750 transition-all cursor-pointer focus:outline-none"
        >
          <span>{showSharedContext ? 'Hide Payload' : 'Show Payload'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(financialContext, null, 2));
            const downloadAnchor = document.createElement('a');
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", "finflow_context_payload.json");
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
          }}
          className="flex items-center space-x-1.5 text-[10px] font-bold text-slate-400 hover:text-white px-2.5 py-1.5 bg-obsidian-800 rounded-lg border border-obsidian-750 transition-all cursor-pointer focus:outline-none"
        >
          <Download size={12} />
          <span>Export context</span>
        </button>
      </div>
    </div>
  );
}
