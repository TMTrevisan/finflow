import React, { useRef, useEffect } from 'react';
import { Square, Send, AlertCircle } from 'lucide-react';

export default function ChatInput({
  userInput,
  setUserInput,
  isGenerating,
  toolStatus,
  errorMessage,
  activeAbortControllerRef,
  handleSendMessage
}) {
  const textareaRef = useRef(null);

  // Auto-grow textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(128, textareaRef.current.scrollHeight)}px`;
    }
  }, [userInput]);

  return (
    <div className="pt-2 shrink-0 space-y-3">
      {errorMessage && (
        <div className="mb-2 p-3 rounded-xl border bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson text-xs flex items-center space-x-2 animate-bounce">
          <AlertCircle size={14} className="shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      
      <form 
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="relative flex items-center"
      >
        <textarea 
          ref={textareaRef}
          rows={1}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          disabled={isGenerating}
          placeholder={isGenerating ? (toolStatus || "Processing models...") : "Ask Copilot e.g., 'Am I over budget on groceries?'"}
          className="w-full bg-obsidian-800/90 border border-obsidian-750/90 focus:border-neon-indigo/60 text-white rounded-2xl pl-4 pr-12 py-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-neon-indigo/30 transition-all placeholder-slate-500 shadow-xl resize-none max-h-32 min-h-[44px] overflow-y-auto align-middle"
        />
        {isGenerating ? (
          <button
            type="button"
            onClick={() => {
              if (activeAbortControllerRef.current) {
                activeAbortControllerRef.current.abort();
              }
            }}
            className="absolute right-2 p-2 bg-neon-crimson hover:bg-neon-crimson/80 text-white rounded-xl transition-all shadow-md cursor-pointer focus:outline-none"
            title="Stop Generating"
          >
            <Square size={14} fill="currentColor" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={!userInput.trim()}
            className="absolute right-2 p-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md cursor-pointer focus:outline-none"
          >
            <Send size={14} />
          </button>
        )}
      </form>
    </div>
  );
}
