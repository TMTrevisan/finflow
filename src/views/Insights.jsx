import React, { useState } from 'react';
import Spending from './Spending';
import Income from './Income';
import PLReport from './PLReport';
import YearlyInsights from './YearlyInsights';
import { cn } from '../components/ui/Card';

export default function Insights() {
  const [activeSubTab, setActiveSubTab] = useState('spending');

  const TABS = [
    { id: 'spending', label: 'Spending' },
    { id: 'income', label: 'Income' },
    { id: 'pl', label: 'P&L Report' },
    { id: 'yearly', label: 'Yearly Insights' },
  ];

  const renderSubView = () => {
    switch (activeSubTab) {
      case 'spending': return <Spending />;
      case 'income': return <Income />;
      case 'pl': return <PLReport />;
      case 'yearly': return <YearlyInsights />;
      default: return <Spending />;
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Sticky Tab Navigator */}
      <div className="sticky top-0 z-30 bg-obsidian-900/95 backdrop-blur pt-2 pb-4 border-b border-obsidian-800 flex items-center overflow-x-auto gap-2 hide-scrollbar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors border",
              activeSubTab === tab.id
                ? "bg-neon-indigo/20 text-neon-indigo border-neon-indigo/30"
                : "bg-obsidian-800 text-slate-400 border-obsidian-700 hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Renders the selected tab view */}
      <div className="flex-1">
        {renderSubView()}
      </div>
    </div>
  );
}
