import React, { useMemo } from 'react';
import { Card, CardContent } from './Card';
import { formatCurrency } from '../../utils/formatting';
import { Users, Info } from 'lucide-react';

export default function ContributionSplit({ transactions = [] }) {
  const splits = useMemo(() => {
    let toddIncome = 0;
    let kaitlynIncome = 0;
    let otherIncome = 0;

    transactions.forEach(t => {
      if (t.type !== 'Income') return;
      const descLower = String(t.description || '').toLowerCase();
      const catLower = String(t.category || '').toLowerCase();

      // Differentiate between Kaitlyn Trevisan Payroll, Todd Trevisan Payroll, and others
      if (descLower.includes('kaitlyn') || descLower.includes('havas') || descLower.includes('everyday checking')) {
        kaitlynIncome += Number(t.amount) || 0;
      } else if (
        descLower.includes('todd') || 
        descLower.includes('becton') || 
        descLower.includes('bd ') || 
        descLower.includes('payroll') || 
        descLower.includes('salary') || 
        catLower.includes('paycheck')
      ) {
        // Exclude annuities from Todd's W2 paycheck
        const isAnnuity = 
          descLower.includes('clear spring') || 
          descLower.includes('clearspring') || 
          descLower.includes('guggenheim') || 
          descLower.includes('natl west') || 
          descLower.includes('national western') || 
          descLower.includes('north american') || 
          catLower.includes('annuity');

        if (isAnnuity) {
          otherIncome += Number(t.amount) || 0;
        } else {
          toddIncome += Number(t.amount) || 0;
        }
      } else {
        otherIncome += Number(t.amount) || 0;
      }
    });

    const total = toddIncome + kaitlynIncome + otherIncome;
    const toddPercent = total > 0 ? (toddIncome / total) * 100 : 0;
    const kaitlynPercent = total > 0 ? (kaitlynIncome / total) * 100 : 0;
    const otherPercent = total > 0 ? (otherIncome / total) * 100 : 0;

    return {
      toddIncome,
      kaitlynIncome,
      otherIncome,
      total,
      toddPercent,
      kaitlynPercent,
      otherPercent
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
          <span>Payroll & Deposit Breakdown</span>
        </span>
      </div>

      <div className="space-y-3.5">
        {/* Progress Bar Split */}
        <div className="h-3 w-full bg-obsidian-900 rounded-full flex overflow-hidden">
          {splits.kaitlynPercent > 0 && (
            <div 
              style={{ width: `${splits.kaitlynPercent}%` }}
              className="h-full bg-neon-emerald transition-all duration-500"
              title={`Kaitlyn: ${splits.kaitlynPercent.toFixed(0)}%`}
            />
          )}
          {splits.toddPercent > 0 && (
            <div 
              style={{ width: `${splits.toddPercent}%` }}
              className="h-full bg-neon-indigo transition-all duration-500"
              title={`Todd: ${splits.toddPercent.toFixed(0)}%`}
            />
          )}
          {splits.otherPercent > 0 && (
            <div 
              style={{ width: `${splits.otherPercent}%` }}
              className="h-full bg-amber-400 transition-all duration-500"
              title={`Other: ${splits.otherPercent.toFixed(0)}%`}
            />
          )}
        </div>

        {/* Legend metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-neon-emerald shrink-0" />
              <span className="text-xs text-slate-400 font-semibold truncate">Kaitlyn (Havas)</span>
            </div>
            <p className="text-sm font-black text-white">{formatCurrency(splits.kaitlynIncome)}</p>
            <p className="text-[10px] text-slate-500 font-bold">{splits.kaitlynPercent.toFixed(0)}% of total</p>
          </div>

          <div className="space-y-1 text-center">
            <div className="flex items-center justify-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded bg-neon-indigo shrink-0" />
              <span className="text-xs text-slate-400 font-semibold truncate">Todd (BD)</span>
            </div>
            <p className="text-sm font-black text-white">{formatCurrency(splits.toddIncome)}</p>
            <p className="text-[10px] text-slate-500 font-bold">{splits.toddPercent.toFixed(0)}% of total</p>
          </div>

          <div className="space-y-1 text-right">
            <div className="flex items-center justify-end space-x-1.5">
              <span className="text-xs text-slate-400 font-semibold truncate">Other / Annuities</span>
              <span className="w-2.5 h-2.5 rounded bg-amber-400 shrink-0" />
            </div>
            <p className="text-sm font-black text-white">{formatCurrency(splits.otherIncome)}</p>
            <p className="text-[10px] text-slate-500 font-bold">{splits.otherPercent.toFixed(0)}% of total</p>
          </div>
        </div>
      </div>
    </Card>
  );
}
