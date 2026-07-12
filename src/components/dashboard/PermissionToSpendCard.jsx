import React from 'react';
import { Compass, ChevronRight, Heart, Shield } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';

export default function PermissionToSpendCard({ surplusMetrics = null, setCurrentView }) {
  if (!surplusMetrics) return null;

  return (
    <div 
      onClick={() => setCurrentView('insights')}
      className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4 hover:border-neon-indigo/55 transition-all duration-300 cursor-pointer group"
    >
      <div className="flex items-center justify-between border-b border-slate-800/40 pb-3">
        <span className="flex items-center space-x-1.5 font-bold text-white group-hover:text-neon-indigo transition-colors text-sm">
          <Compass className="text-neon-indigo animate-spin-slow" size={16} />
          <span>Permission to Spend</span>
        </span>
        <span className="text-xs text-slate-500 font-semibold flex items-center gap-0.5 group-hover:text-slate-350 transition-colors">
          View <ChevronRight size={12} />
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Option A: Rolling 30D */}
        <div className="space-y-1.5">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Heart size={10} className="text-neon-indigo" />
            <span>Rolling 30-Day Surplus</span>
          </span>
          <p className="text-[9px] text-slate-400 leading-tight">
            Net Income minus actual Baseline & Compounding expenses over the past 30 days.
          </p>
          <p className={`text-sm font-black tracking-tight ${surplusMetrics.rolling.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {surplusMetrics.rolling.surplus >= 0 
              ? formatCurrency(surplusMetrics.rolling.surplus) 
              : `Over budget by ${formatCurrency(Math.abs(surplusMetrics.rolling.surplus))}`}
          </p>
          <span className="text-[9px] font-bold text-slate-450 block leading-tight">
            {surplusMetrics.rolling.surplus >= 0 ? '✓ Clear to Spend' : '⚠️ Deficit'}
          </span>
          <div className="w-full h-1 bg-obsidian-950 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full rounded-full ${surplusMetrics.rolling.surplus >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, ((surplusMetrics.rolling.baseline + surplusMetrics.rolling.compounding) / Math.max(surplusMetrics.rolling.income, 1)) * 100)}%` }}
            />
          </div>
        </div>

        {/* Option B: Blended Projected */}
        <div className="space-y-1.5 border-l border-slate-850/40 pl-4">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
            <Shield size={10} className="text-neon-indigo" />
            <span>Projected Monthly Budget</span>
          </span>
          <p className="text-[9px] text-slate-400 leading-tight">
            Forecasted surplus combining month-to-date actual values and remaining budgets.
          </p>
          <p className={`text-sm font-black tracking-tight ${surplusMetrics.projected.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {surplusMetrics.projected.surplus >= 0 
              ? formatCurrency(surplusMetrics.projected.surplus) 
              : `Over budget by ${formatCurrency(Math.abs(surplusMetrics.projected.surplus))}`}
          </p>
          <span className="text-[9px] font-bold text-slate-450 block leading-tight">
            {surplusMetrics.projected.surplus >= 0 ? '✓ Projected Surplus' : '⚠️ Deficit'}
          </span>
          <div className="w-full h-1 bg-obsidian-950 rounded-full overflow-hidden mt-1">
            <div 
              className={`h-full rounded-full ${surplusMetrics.projected.surplus >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
              style={{ width: `${Math.min(100, ((surplusMetrics.projected.baseline + surplusMetrics.projected.compounding) / Math.max(surplusMetrics.projected.income, 1)) * 100)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
