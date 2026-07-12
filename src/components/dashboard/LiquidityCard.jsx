import React from 'react';
import { DollarSign, ChevronRight } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';

export default function LiquidityCard({ liquidityStats = {}, setCurrentView }) {
  return (
    <div 
      onClick={() => setCurrentView('wealth')}
      className="bg-[#0B0E14] border border-[#161B26] hover:border-neon-indigo/55 transition-all duration-300 p-5 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group"
    >
      <div className="flex items-center space-x-3.5">
        <div className="p-2.5 bg-neon-indigo/10 rounded-xl text-neon-indigo">
          <DollarSign size={20} />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Liquidity & Cash Drag Analysis</p>
          <p className="text-sm font-semibold text-white mt-1">
            Cash Sweep: <span className="font-mono text-neon-indigo font-bold">{formatCurrency(liquidityStats.totalCash || 0)}</span> ({ (liquidityStats.cashDragRatio || 0).toFixed(1)}%) • Invested Assets: <span className="font-mono text-[#10B981] font-bold">{formatCurrency(liquidityStats.totalInvested || 0)}</span>
          </p>
        </div>
      </div>
      <div className="flex items-center space-x-2 shrink-0">
        <span className={`text-xs font-bold ${liquidityStats.recommendationColor || 'text-slate-400'}`}>
          {liquidityStats.recommendation || '—'}
        </span>
        <ChevronRight size={14} className="text-slate-500 group-hover:text-white transition-colors" />
      </div>
    </div>
  );
}
