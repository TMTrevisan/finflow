import React from 'react';
import { formatCurrency } from '../../utils/formatting';

export default function SpendingCard({ spendingMetrics = {}, setCurrentView }) {
  if (!spendingMetrics || !spendingMetrics.topCategories) return null;

  return (
    <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white">Spending</h4>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column: MTD total and top expenses */}
        <div className="space-y-4">
          <div className="bg-[#A855F7]/10 border border-[#A855F7]/20 rounded-2xl p-4 inline-block">
            <span className="text-2xl font-extrabold text-[#C084FC] block">{formatCurrency(spendingMetrics.mtdTotal)}</span>
            <span className="text-[10px] text-[#C084FC] font-semibold uppercase tracking-wider block mt-0.5">Month to date</span>
          </div>
          
          <div className="space-y-2">
            <h5 className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Top expenses in June</h5>
            <div className="space-y-2">
              {spendingMetrics.topCategories.map((cat, i) => (
                <div key={i} className="flex justify-between items-center text-xs">
                  <span className="text-slate-300 font-medium">{cat.name}</span>
                  <div className="flex items-center space-x-4">
                    <span className="text-slate-500 font-mono w-8 text-right">{cat.percentage}%</span>
                    <span className="text-white font-bold font-mono w-20 text-right">{formatCurrency(cat.amount)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 6-Month Bar Chart */}
        <div className="relative flex flex-col justify-between h-full min-h-[160px]">
          <div className="flex-1 relative flex items-end justify-between gap-2 h-32 pb-5 border-b border-slate-800/40">
            {/* Horizontal grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[7px] font-bold text-slate-600">
              <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$15K</span></div>
              <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$10K</span></div>
              <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$5K</span></div>
              <div className="w-full border-t border-dashed border-slate-850 pt-0.5 flex justify-between"><span>$0</span></div>
            </div>

            {/* 3-Month Average dashed line */}
            <div 
              className="absolute left-0 right-0 border-t border-dashed border-blue-500 z-10 pointer-events-none"
              style={{ bottom: `${(spendingMetrics.average / 15000) * 100}%` }}
            />

            {/* The Bars */}
            {spendingMetrics.monthlyTotals.map((bar, i) => {
              const heightPct = Math.min(100, (bar.total / 15000) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center z-20 relative group h-full justify-end">
                  <div 
                    className={`w-full rounded-t transition-all duration-300 relative ${
                      bar.label === 'Jun' 
                        ? 'bg-[#A855F7]/40 hover:bg-[#A855F7]/60' 
                        : 'bg-[#A855F7] hover:bg-[#C084FC]'
                    }`}
                    style={{ height: `${heightPct}%` }}
                  >
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-black px-2 py-1 rounded text-[10px] font-bold text-white whitespace-nowrap z-30">
                      {bar.label} '26: {formatCurrency(bar.total)}
                    </div>
                  </div>
                  <span className="text-[8px] font-bold text-slate-500 absolute top-full mt-1.5 uppercase">
                    {bar.label}
                  </span>
                  <span className="text-[7px] font-semibold text-slate-600 absolute top-full mt-3 uppercase">
                    '26
                  </span>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="flex items-center space-x-1 text-[8px] text-slate-400 font-semibold">
              <span className="w-3 border-t border-dashed border-blue-500" />
              <span>Average for last 3 months (Mar - May `26) : <strong className="text-white font-extrabold">{formatCurrency(spendingMetrics.average)}</strong></span>
            </div>
            <button 
              onClick={() => setCurrentView('spending')}
              className="text-xs font-bold text-blue-500 hover:underline flex items-center space-x-1"
            >
              <span>See more</span>
              <span>&raquo;</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
