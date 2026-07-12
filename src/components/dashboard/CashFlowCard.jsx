import React from 'react';
import { Info } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';

export default function CashFlowCard({
  cashFlowTrendMetrics = {},
  creditCardUsage = {},
  savingsHistory = [],
  totals = {},
  baselineExpenses = 0,
  emergencyFundTarget = 0,
  setCurrentView
}) {
  return (
    <div className="space-y-6">
      {/* CASH FLOW TREND CARD */}
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">Cash Flow</h4>
        </div>
        
        <div className="bg-obsidian-950/20 border border-slate-800/40 rounded-2xl p-4 text-center">
          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Average monthly net cashflow</span>
          <div className="flex items-center justify-center space-x-1.5 mt-1">
            <span className="text-xl font-extrabold text-white">{formatCurrency(cashFlowTrendMetrics.avgNet || 0)}</span>
            <Info size={14} className="text-blue-500 cursor-pointer" />
          </div>
        </div>

        {/* Custom SVG Line Chart */}
        <div className="relative h-32 pt-2">
          <div className="absolute left-0 top-0 bottom-0 w-8 flex flex-col justify-between text-[8px] font-bold text-slate-500 pr-1 pointer-events-none select-none">
            <span>$25K</span>
            <span>$0</span>
            <span>-$25K</span>
            <span>-$50K</span>
          </div>

          <div className="pl-8 h-full">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="0" y1="0" x2="100" y2="0" stroke="var(--obsidian-750)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="33.3" x2="100" y2="33.3" stroke="var(--obsidian-750)" strokeWidth="1" />
              <line x1="0" y1="66.6" x2="100" y2="66.6" stroke="var(--obsidian-750)" strokeWidth="0.5" strokeDasharray="2,2" />
              <line x1="0" y1="100" x2="100" y2="100" stroke="var(--obsidian-750)" strokeWidth="0.5" strokeDasharray="2,2" />

              <path
                d="M 10 33.3 L 10 30 C 25 30, 25 26, 40 26 C 55 26, 55 44, 70 44 C 80 44, 80 74, 90 74 L 90 100 L 10 100 Z"
                fill="url(#cashflow-gradient-dash)"
                opacity="0.15"
              />

              <path
                d="M 10 30 C 25 30, 25 26, 40 26 C 55 26, 55 44, 70 44 C 80 44, 80 74, 90 74"
                fill="none"
                stroke="#0066CC"
                strokeWidth="2"
                strokeLinecap="round"
              />

              <circle cx="10" cy="30" r="1.5" fill="#0066CC" stroke="#FFFFFF" strokeWidth="0.5" />
              <circle cx="40" cy="26" r="1.5" fill="#0066CC" stroke="#FFFFFF" strokeWidth="0.5" />
              <circle cx="70" cy="44" r="1.5" fill="#0066CC" stroke="#FFFFFF" strokeWidth="0.5" />
              <circle cx="90" cy="74" r="1.5" fill="#0066CC" stroke="#FFFFFF" strokeWidth="0.5" />

              <defs>
                <linearGradient id="cashflow-gradient-dash" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#0066CC" />
                  <stop offset="100%" stopColor="#0066CC" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>

          <div className="pl-8 flex justify-between text-[8px] font-bold text-slate-500 pt-1">
            <span className="w-16 text-center -ml-4">Mar '26</span>
            <span className="w-16 text-center">Apr '26</span>
            <span className="w-16 text-center">May '26</span>
            <span className="w-16 text-center -mr-4">Jun '26</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={() => setCurrentView('cashflow')}
            className="text-xs font-bold text-blue-500 hover:underline flex items-center space-x-1"
          >
            <span>See more</span>
            <span>&raquo;</span>
          </button>
        </div>
      </div>

      {/* CREDIT CARD USAGE CARD */}
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-white">Credit Card Usage</h4>
        </div>
        
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="58"
                className="stroke-[#161B26]"
                strokeWidth="8"
                fill="transparent"
              />
              <circle
                cx="72"
                cy="72"
                r="58"
                className="stroke-[#0066CC]"
                strokeWidth="8"
                fill="transparent"
                strokeDasharray={2 * Math.PI * 58}
                strokeDashoffset={2 * Math.PI * 58 * (1 - (creditCardUsage.pct || 0) / 100)}
                strokeLinecap="round"
              />
            </svg>
            <div className="text-center z-10">
              <span className="text-3xl font-extrabold text-[#0066CC] block">{creditCardUsage.pct || 0}%</span>
              <span className="text-[10px] text-slate-400 font-bold block mt-0.5">{creditCardUsage.cardCount || 0} Cards</span>
            </div>
          </div>
          
          <div className="text-center space-y-1">
            <p className="text-sm font-extrabold text-white">
              <span className="text-[#0066CC]">{formatCurrency(creditCardUsage.totalUsed || 0)}</span> of {formatCurrency(creditCardUsage.totalLimit || 0)}
            </p>
            <span className="text-[9px] font-black text-slate-500 block uppercase tracking-widest">USED</span>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button 
            onClick={() => setCurrentView('accounts')}
            className="text-xs font-bold text-blue-500 hover:underline flex items-center space-x-1"
          >
            <span>See more</span>
            <span>&raquo;</span>
          </button>
        </div>
      </div>

      {/* EMERGENCY FUND BAR CHART CARD */}
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <button 
            onClick={() => setCurrentView('budgets')}
            className="flex items-center space-x-1 font-bold text-white hover:text-neon-indigo transition-colors text-sm"
          >
            <span>Emergency Fund</span>
            <Info size={13} className="text-slate-500 shrink-0" />
            <span className="text-slate-400 font-normal">»</span>
          </button>
          <span className="text-sm font-extrabold text-white">
            {formatCurrency(totals.savingsBalance || 0)}
          </span>
        </div>

        <div className="space-y-4 pt-1">
          <div className="h-28 flex items-end justify-between gap-1 select-none">
            {savingsHistory.map((bar, i) => (
              <div key={i} className="flex-1 flex flex-col items-center">
                <div className="w-full h-20 flex items-end">
                  <div 
                    className="w-full rounded-t bg-neon-indigo/35 hover:bg-neon-indigo/60 transition-all relative group"
                    style={{ height: `${bar.val}%` }}
                  >
                    <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black px-2 py-1 rounded text-[10px] font-bold text-white whitespace-nowrap z-10">
                      {bar.m}: {bar.isPlaceholder ? 'Placeholder Trend' : formatCurrency(bar.actualVal)}
                    </div>
                  </div>
                </div>
                <span className="text-[8px] font-black text-slate-500 mt-2 block uppercase text-center min-h-[10px]">
                  {i % 2 === 0 ? bar.m : ''}
                </span>
              </div>
            ))}
          </div>

          <div className="text-[10px] text-slate-455 leading-relaxed pt-2 border-t border-slate-800/40 italic">
            {(totals.savingsBalance || 0) > emergencyFundTarget 
              ? `${formatCurrency((totals.savingsBalance || 0) - emergencyFundTarget)} could be invested for potential greater returns as you have met your 6-month baseline target of ${formatCurrency(emergencyFundTarget)}.`
              : `You have ${(baselineExpenses > 0 ? ((totals.savingsBalance || 0) / baselineExpenses).toFixed(1) : 0)} months of baseline expenses covered. Keep building savings to reach your ${formatCurrency(emergencyFundTarget)} target (6 months of baseline expenses).`}
          </div>
        </div>
      </div>
    </div>
  );
}
