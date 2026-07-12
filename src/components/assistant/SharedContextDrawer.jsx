import React from 'react';
import { BottomSheet } from '../ui/BottomSheet';

export default function SharedContextDrawer({
  showSharedContext,
  setShowSharedContext,
  financialContext
}) {
  return (
    <BottomSheet 
      isOpen={showSharedContext} 
      onClose={() => setShowSharedContext(false)}
      title="Model Prompt Context Payload"
    >
      <div className="space-y-4">
        <p className="text-xs text-slate-400 leading-normal">
          This is the exact structured, anonymized, and compressed JSON context sent to LLM models for copilot responses. Sensitive details such as full account numbers are automatically redacted.
        </p>

        <div className="bg-obsidian-900 border border-obsidian-750 rounded-2xl p-4 overflow-x-auto max-h-[50vh] scrollbar-thin">
          <pre className="text-[10px] text-slate-400 font-mono select-all whitespace-pre-wrap">
            {JSON.stringify(financialContext, null, 2)}
          </pre>
        </div>
      </div>
    </BottomSheet>
  );
}
