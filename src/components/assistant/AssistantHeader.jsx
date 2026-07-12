import React from 'react';
import { Brain, Sparkles, Activity, Server } from 'lucide-react';

export default function AssistantHeader({
  fiduciaryMode,
  handleToggleFiduciaryMode,
  aiProvider,
  aiModel,
  mcpEnabled,
  mcpStatus,
  mcpToolsLength
}) {
  return (
    <div className="flex items-center justify-between border-b border-obsidian-800/85 pb-4 shrink-0">
      <div className="flex items-center space-x-3">
        <div className={`p-2.5 rounded-xl border transition-all duration-300 ${
          fiduciaryMode 
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]' 
            : 'bg-neon-indigo/10 text-neon-indigo border-neon-indigo/15'
        }`}>
          <Brain size={20} className="animate-pulse" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white font-display flex items-center space-x-1.5">
            <span>{fiduciaryMode ? 'Fiduciary Advisor' : 'FinFlow Copilot'}</span>
            <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none capitalize border ${
              fiduciaryMode
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-400'
                : 'bg-neon-indigo/15 border-neon-indigo/25 text-neon-indigo'
            }`}>{aiProvider}</span>
          </h1>
          <p className="text-[10px] text-slate-400">
            {fiduciaryMode 
              ? 'Legally bound to act in your sole best interest' 
              : 'Contextual intelligence parsing local accounts & budgets'}
          </p>
        </div>
      </div>

      {/* Diagnostic active model & MCP indicator */}
      <div className="flex items-center space-x-2 text-[10px] text-slate-450">
        {/* Fiduciary Advisor Toggle */}
        <button
          onClick={() => handleToggleFiduciaryMode(!fiduciaryMode)}
          className={`flex items-center space-x-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-bold transition-all select-none cursor-pointer ${
            fiduciaryMode 
              ? 'bg-amber-500/10 border-amber-500/35 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)] font-extrabold'
              : 'bg-obsidian-850 hover:bg-obsidian-800 border-obsidian-750 text-slate-400 hover:text-slate-350'
          }`}
          title="Enable legally bound fiduciary financial advisor & planner mode"
        >
          <Sparkles size={10} className={fiduciaryMode ? "text-amber-400 animate-pulse" : ""} />
          <span>Fiduciary Advisor</span>
        </button>

        <div className="flex items-center space-x-1 px-2 py-1 bg-obsidian-850 rounded-lg border border-obsidian-750">
          <Activity size={10} className="text-neon-emerald" />
          <span className="truncate max-w-[80px] md:max-w-none">{aiModel}</span>
        </div>
        {mcpEnabled && (
          <div 
            onClick={() => {
              if (mcpStatus === 'offline' || mcpStatus === 'sleeping') {
                window.location.reload();
              }
            }}
            title={mcpStatus === 'offline' || mcpStatus === 'sleeping' ? "Click to retry connection" : ""}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[10px] font-bold select-none transition-all ${
              mcpStatus === 'offline' || mcpStatus === 'sleeping' ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''
            } ${
              mcpStatus === 'online'
                ? 'bg-neon-emerald/10 border-neon-emerald/25 text-neon-emerald'
                : mcpStatus === 'connecting'
                ? 'bg-neon-indigo/15 border-neon-indigo/25 text-neon-indigo animate-pulse'
                : mcpStatus === 'sleeping'
                ? 'bg-amber-500/10 border-amber-500/25 text-amber-500 animate-pulse'
                : 'bg-neon-crimson/10 border-neon-crimson/25 text-neon-crimson'
            }`}
          >
            <Server size={10} className={mcpStatus === 'connecting' || mcpStatus === 'sleeping' ? 'animate-bounce' : ''} />
            <span>
              {mcpStatus === 'online' && `MCP Active (${mcpToolsLength})`}
              {mcpStatus === 'connecting' && 'Connecting...'}
              {mcpStatus === 'sleeping' && 'Server Sleeping...'}
              {mcpStatus === 'offline' && 'MCP Offline (Tap to Retry)'}
              {mcpStatus === 'idle' && 'MCP Disabled'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
