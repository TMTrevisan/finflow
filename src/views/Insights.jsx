import React, { useState } from 'react';
import SpendingTrends from './SpendingTrends';
import LifeOptimization from './LifeOptimization';
import Spending from './Spending';
import Income from './Income';
import PLReport from './PLReport';
import YearlyInsights from './YearlyInsights';
import { cn } from '../components/ui/Card';

export default function Insights() {
  const [activeSubTab, setActiveSubTab] = useState('spending_trends');

  const TABS = [
    { id: 'spending_trends', label: 'Spending Trends' },
    { id: 'life_optimization', label: 'Permission to Spend' },
    { id: 'spending', label: 'Spending Breakdown' },
    { id: 'income', label: 'Income Breakdown' },
    { id: 'pl', label: 'P&L Report' },
    { id: 'yearly', label: 'Yearly Insights' },
  ];

  const renderSubView = () => {
    switch (activeSubTab) {
      case 'spending_trends': return <SpendingTrends />;
      case 'life_optimization': return <LifeOptimization />;
      case 'spending': return <Spending />;
      case 'income': return <Income />;
      case 'pl': return <PLReport />;
      case 'yearly': return <YearlyInsights />;
      default: return <SpendingTrends />;
    }
  };

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Sticky Tab Navigator */}
      <div className="sticky top-0 z-30 bg-obsidian-900/95 backdrop-blur-md py-4 border-b border-obsidian-800 flex items-center overflow-x-auto overflow-y-visible gap-3.5 px-3 w-full hide-scrollbar scroll-smooth min-h-[64px]">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={cn(
              "whitespace-nowrap px-5 py-2.5 rounded-full text-xs md:text-sm font-bold tracking-wide transition-all border cursor-pointer select-none shrink-0",
              activeSubTab === tab.id
                ? "bg-neon-indigo/25 text-neon-indigo border-neon-indigo/50 shadow-[0_0_14px_rgba(99,102,241,0.2)]"
                : "bg-obsidian-800 text-slate-350 border-obsidian-750 hover:text-white hover:bg-obsidian-750"
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
