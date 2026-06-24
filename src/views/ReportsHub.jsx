import React, { useState } from 'react';
import PLReport from './PLReport';
import YearlyInsights from './YearlyInsights';

export default function ReportsHub() {
  const [activeTab, setActiveTab] = useState('plreport');

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-obsidian-800 space-x-6 pb-2">
        <button
          onClick={() => setActiveTab('plreport')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'plreport' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Monthly P&L
        </button>
        <button
          onClick={() => setActiveTab('yearly')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'yearly' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Yearly Comparison
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'plreport' && <PLReport />}
        {activeTab === 'yearly' && <YearlyInsights />}
      </div>
    </div>
  );
}
