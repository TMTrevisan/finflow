import React from 'react';
import { Card } from '../ui/Card';
import { Sparkles, Brain, Key } from 'lucide-react';

export default function OnboardingKeyScreen({
  aiProvider,
  aiModel,
  onboardingKeyInput,
  setOnboardingKeyInput,
  handleSaveOnboardingKey
}) {
  return (
    <div className="flex flex-col items-center justify-center max-w-lg mx-auto min-h-[70vh] py-8 px-6 text-center space-y-6 animate-fade-in">
      <div className="bg-obsidian-800 p-5 rounded-3xl border border-obsidian-750/80 shadow-2xl relative">
        <div className="absolute -top-3 -right-3 bg-neon-indigo p-1.5 rounded-xl text-white shadow-glow">
          <Sparkles size={16} />
        </div>
        <Brain size={48} className="text-neon-indigo animate-pulse" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-black text-white font-display">Configure FinFlow Copilot</h1>
        <p className="text-xs text-slate-400">
          Selected Provider: <span className="font-bold text-neon-indigo capitalize">{aiProvider}</span> (Model: {aiModel})
        </p>
        <p className="text-sm text-slate-400">
          Please enter your API Key to authenticate the assistant model.
        </p>
      </div>

      <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 w-full space-y-4">
        <div className="text-left space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
            <span>{aiProvider.toUpperCase()} API Key</span>
          </label>
          <input 
            type="password" 
            value={onboardingKeyInput}
            onChange={(e) => setOnboardingKeyInput(e.target.value)}
            placeholder={`Paste your ${aiProvider} key here...`}
            className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
          />
        </div>

        <button
          onClick={handleSaveOnboardingKey}
          className="w-full py-2.5 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2 cursor-pointer focus:outline-none"
        >
          <Key size={14} />
          <span>Connect Assistant</span>
        </button>
      </Card>
    </div>
  );
}
