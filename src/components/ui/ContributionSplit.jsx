import React, { useMemo } from 'react';
import { Card, CardContent } from './Card';
import { formatCurrency } from '../../utils/formatting';
import { User, Users, Info } from 'lucide-react';

export default function ContributionSplit({ transactions = [] }) {
  const splits = useMemo(() => {
    let selfIncome = 0;
    let spouseIncome = 0;

    transactions.forEach(t => {
      if (t.type !== 'Income') return;
      const descLower = String(t.description || '').toLowerCase();
      const catLower = String(t.category || '').toLowerCase();

      // Check if description indicates wife/spouse/joint/family funding
      const isSpouse = 
        descLower.includes('wife') || 
        descLower.includes('spouse') || 
        descLower.includes('joint') || 
        descLower.includes('olivia') || // Explicit check for partner's name from My529 check
        catLower.includes('wife') || 
        catLower.includes('spouse') || 
        catLower.includes('family funding');

      if (isSpouse) {
        spouseIncome += Number(t.amount) || 0;
      } else {
        selfIncome += Number(t.amount) || 0;
      }
    });

    const total = selfIncome + spouseIncome;
    const selfPercent = total > 0 ? (selfIncome / total) * 100 : 50;
    const spousePercent = total > 0 ? (spouseIncome / total) * 100 : 50;

    return {
      selfIncome,
      spouseIncome,
      total,
      selfPercent,
      spousePercent
    };
  }, [transactions]);

  if (splits.total === 0) {
    return null;
  }

  return (
    <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
          <Users size={16} className="text-neon-indigo" />
          <span>Household Income Split</span>
        </h4>
        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
          <Info size={10} />
          <span>Self vs. Spouse/Family</span>
        </span>
      </div>

      <div className="space-y-3.5">
        {/* Progress Bar Split */}
        <div className="h-3 w-full bg-obsidian-900 rounded-full flex overflow-hidden">
          <div 
            style={{ width: `${splits.selfPercent}%` }}
            className="h-full bg-neon-indigo transition-all duration-500"
            title={`Self: ${splits.selfPercent.toFixed(0)}%`}
          />
          <div 
            style={{ width: `${splits.spousePercent}%` }}
            className="h-full bg-neon-emerald transition-all duration-500"
            title={`Spouse/Joint: ${splits.spousePercent.toFixed(0)}%`}
          />
        </div>

        {/* Legend metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-neon-indigo shrink-0" />
              <span className="text-xs text-slate-400 font-semibold truncate">Self (Salary/Direct)</span>
            </div>
            <p className="text-sm font-black text-white">{formatCurrency(splits.selfIncome)}</p>
            <p className="text-[10px] text-slate-500 font-bold">{splits.selfPercent.toFixed(0)}% of total</p>
          </div>

          <div className="space-y-1 text-right">
            <div className="flex items-center justify-end space-x-1.5">
              <span className="text-xs text-slate-400 font-semibold truncate">Spouse / Joint Transfers</span>
              <span className="w-2.5 h-2.5 rounded bg-neon-emerald shrink-0" />
            </div>
            <p className="text-sm font-black text-white">{formatCurrency(splits.spouseIncome)}</p>
            <p className="text-[10px] text-slate-500 font-bold">{splits.spousePercent.toFixed(0)}% of total</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
