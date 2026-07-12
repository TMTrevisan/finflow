import React, { useState } from 'react';
import { Brain, Copy, Check, ArrowRight, Sparkles, Activity, RefreshCw } from 'lucide-react';

// Helper to extract custom suggestion tags
const parseSuggestions = (content) => {
  if (!content) return { text: '', suggestions: [] };
  const match = content.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
  if (!match) return { text: content, suggestions: [] };
  
  const textWithoutSuggestions = content.replace(/<suggestions>([\s\S]*?)<\/suggestions>/, '').trim();
  const suggestionsList = match[1]
    .split('|')
    .map(s => s.trim())
    .filter(s => s.length > 0);
    
  return { text: textWithoutSuggestions, suggestions: suggestionsList };
};

const parseInlineMarkdown = (line) => {
  const parts = line.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={idx} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
};

// Simple client-side markdown formatter
const renderMarkdown = (text) => {
  if (!text) return null;
  const paragraphs = text.split('\n');

  return paragraphs.map((para, i) => {
    let trimmed = para.trim();
    if (!trimmed) return <div key={i} className="h-2" />;

    if (trimmed.startsWith('### ')) {
      return <h4 key={i} className="text-sm font-bold text-white mt-3 mb-1.5">{trimmed.replace('### ', '')}</h4>;
    }
    if (trimmed.startsWith('## ')) {
      return <h3 key={i} className="text-base font-bold text-white mt-4 mb-2">{trimmed.replace('## ', '')}</h3>;
    }
    if (trimmed.startsWith('# ')) {
      return <h2 key={i} className="text-lg font-black text-white mt-4 mb-2">{trimmed.replace('# ', '')}</h2>;
    }

    if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
      if (trimmed.includes('---')) return null;
      const cells = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      return (
        <div key={i} className="flex border-b border-obsidian-800/80 py-1.5 text-xs text-slate-350 hover:bg-obsidian-800/10">
          {cells.map((cell, cellIdx) => (
            <span key={cellIdx} className={`flex-1 min-w-0 truncate ${cellIdx === cells.length - 1 ? 'text-right font-semibold text-slate-200' : ''}`}>
              {cell.replace(/\*\*/g, '')}
            </span>
          ))}
        </div>
      );
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const cleanBullet = trimmed.replace(/^[-*]\s+/, '');
      return (
        <li key={i} className="text-xs text-slate-350 list-disc ml-4 my-1">
          {parseInlineMarkdown(cleanBullet)}
        </li>
      );
    }

    return (
      <p key={i} className="text-xs leading-relaxed text-slate-300 my-1">
        {parseInlineMarkdown(trimmed)}
      </p>
    );
  });
};

export default function MessageFeed({
  chatLog = [],
  isGenerating,
  fiduciaryMode,
  triggerFiduciaryAudit,
  activeSuggestions = [],
  toolStatus,
  chatEndRef,
  handleSendMessage
}) {
  const [copiedIndex, setCopiedIndex] = useState(null);

  const handleCopyText = (content, index) => {
    const cleanContent = content.replace(/<suggestions>[\s\S]*?<\/suggestions>/gi, '').trim();
    navigator.clipboard.writeText(cleanContent);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1 hide-scrollbar">
      {chatLog.map((message, index) => {
        const isModel = message.role === 'model';
        const { text, suggestions } = isModel ? parseSuggestions(message.content) : { text: message.content, suggestions: [] };

        return (
          <div 
            key={index}
            className={`flex items-start gap-3 ${
              message.role === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {message.role === 'model' && (
              <div className="p-1.5 bg-neon-indigo/15 rounded-lg border border-neon-indigo/25 text-neon-indigo shrink-0">
                <Brain size={14} />
              </div>
            )}

            <div className="flex flex-col space-y-2 max-w-[85%]">
              <div className={`p-4 rounded-2xl border shadow-sm relative group/msg ${
                message.role === 'user'
                  ? 'bg-neon-indigo/15 border-neon-indigo/25 text-slate-200'
                  : message.isError
                  ? 'bg-neon-crimson/10 border-neon-crimson/25 text-neon-crimson'
                  : 'bg-obsidian-800/40 border-obsidian-800/80 text-slate-350'
              }`}>
                <button
                  onClick={() => handleCopyText(message.content, index)}
                  className="absolute top-2 right-2 p-1 rounded bg-obsidian-900/85 border border-obsidian-750 text-slate-400 hover:text-white opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 cursor-pointer flex items-center justify-center shadow-md focus:outline-none"
                  title="Copy message"
                >
                  {copiedIndex === index ? <Check size={12} className="text-neon-emerald" /> : <Copy size={12} />}
                </button>

                <div className="space-y-2 pr-4">
                  {text ? renderMarkdown(text) : (
                    <div className="flex items-center space-x-2 text-xs text-slate-500">
                      <RefreshCw size={12} className="animate-spin" />
                      <span>Analyzing database variables...</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Render inline follow-up suggestion chips */}
              {isModel && suggestions.length > 0 && !isGenerating && index === chatLog.length - 1 && (
                <div className="flex flex-wrap gap-2 pt-1 animate-fade-in">
                  {suggestions.map((suggestionText, sugIdx) => (
                    <button
                      key={sugIdx}
                      onClick={() => handleSendMessage(suggestionText)}
                      className="text-left px-3.5 py-1.5 bg-obsidian-800/45 hover:bg-neon-indigo/15 border border-obsidian-750 hover:border-neon-indigo/40 text-[10px] font-semibold text-slate-355 hover:text-white rounded-full transition-all duration-155 active:scale-[0.98] shadow-sm cursor-pointer focus:outline-none"
                    >
                      {suggestionText}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
      
      {/* Starter suggestion chips */}
      {chatLog.length === 1 && (
        <div className="space-y-4 pt-6 max-w-2xl">
          {fiduciaryMode && (
            <button
              onClick={triggerFiduciaryAudit}
              className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent hover:from-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 rounded-2xl transition-all duration-200 cursor-pointer text-left group active:scale-[0.99] shadow-[0_0_15px_rgba(245,158,11,0.05)] focus:outline-none"
            >
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-xl">
                  <Sparkles size={16} className="animate-pulse" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs sm:text-sm">Run Fiduciary Financial Audit</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Perform a comprehensive best-interest analysis of fees, cash drag, allocations, and emergency reserves.</p>
                </div>
              </div>
              <ArrowRight size={16} className="text-amber-500 group-hover:translate-x-1.5 transition-all shrink-0 ml-3 animate-pulse" />
            </button>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {activeSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s)}
                className={`text-left p-3.5 border rounded-2xl text-xs font-semibold transition-all duration-150 flex items-center justify-between group active:scale-[0.98] cursor-pointer focus:outline-none ${
                  fiduciaryMode
                    ? 'bg-obsidian-800/25 hover:bg-obsidian-800/55 border-amber-500/10 hover:border-amber-500/25 text-slate-350 hover:text-white'
                    : 'bg-obsidian-800/35 hover:bg-obsidian-800/60 border-obsidian-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <span>{s}</span>
                <ArrowRight size={14} className={`text-slate-500 group-hover:translate-x-1 transition-all shrink-0 ml-3 ${
                  fiduciaryMode ? 'group-hover:text-amber-500' : 'group-hover:text-neon-indigo'
                }`} />
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Tool Call status details */}
      {toolStatus && (
        <div className="flex items-center space-x-2 text-xs text-slate-500 pl-8 py-1 animate-pulse">
          <Activity size={12} className="animate-spin text-neon-indigo" />
          <span>{toolStatus}</span>
        </div>
      )}

      <div ref={chatEndRef} />
    </div>
  );
}
