import React, { useMemo } from 'react';
import { Card, CardContent } from './Card';
import { formatCurrency } from '../../utils/formatting';
import { AlertTriangle, TrendingUp, HelpCircle } from 'lucide-react';

export default function AnomalyDetector({ currentTransactions = [], allTransactions = [] }) {
  const anomalies = useMemo(() => {
    if (currentTransactions.length === 0 || allTransactions.length === 0) return [];

    // 1. Group current period expenses by category
    const currentCats = {};
    currentTransactions.forEach(t => {
      if (t.type !== 'Expense') return;
      const cat = t.category || 'Uncategorized';
      currentCats[cat] = (currentCats[cat] || 0) - t.amount;
    });

    // 2. Identify the date limits of the current period to exclude them from the baseline
    const currentDates = currentTransactions.map(t => new Date(t.date).getTime()).filter(t => !isNaN(t));
    if (currentDates.length === 0) return [];
    
    const minCurrentDate = Math.min(...currentDates);
    const maxCurrentDate = Math.max(...currentDates);

    // Baseline window: 90 days before the start of the current period
    const baselineStart = new Date(minCurrentDate - 90 * 24 * 60 * 60 * 1000);
    const baselineEnd = new Date(minCurrentDate);

    // 3. Group baseline expenses by category
    const baselineCats = {};
    allTransactions.forEach(t => {
      if (t.type !== 'Expense') return;
      const d = new Date(t.date);
      if (isNaN(d.getTime())) return;
      if (d >= baselineStart && d < baselineEnd) {
        const cat = t.category || 'Uncategorized';
        baselineCats[cat] = (baselineCats[cat] || 0) - t.amount;
      }
    });

    // 4. Calculate monthly average for baseline (total baseline divided by 3 months)
    const baselineAverages = {};
    Object.keys(baselineCats).forEach(cat => {
      baselineAverages[cat] = baselineCats[cat] / 3;
    });

    // 5. Compare current vs baseline averages
    const list = [];
    Object.entries(currentCats).forEach(([cat, currentAmount]) => {
      const avgBaseline = baselineAverages[cat] || 0;
      
      // If baseline is 0, we can use a minimum threshold check (e.g. $100) to avoid infinity warnings
      if (avgBaseline > 50) {
        const increase = currentAmount - avgBaseline;
        const percentIncrease = (increase / avgBaseline) * 100;

        if (percentIncrease >= 30) {
          list.push({
            category: cat,
            currentAmount,
            baselineAmount: avgBaseline,
            percentIncrease,
            increase
          });
        }
      }
    });

    return list.sort((a, b) => b.percentIncrease - a.percentIncrease);
  }, [currentTransactions, allTransactions]);

  if (anomalies.length === 0) {
    return null;
  }

  return (
    <Card className="bg-obsidian-800/40 border-neon-crimson/15 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
          <AlertTriangle size={16} className="text-neon-crimson" />
          <span>Spending Alerts (Spikes)</span>
        </h4>
        <span className="text-[10px] text-slate-500 font-bold flex items-center gap-1">
          <span>vs. 3-Month Average</span>
        </span>
      </div>

      <div className="space-y-3">
        {anomalies.map(anom => (
          <div 
            key={anom.category}
            className="flex items-center justify-between p-3 bg-neon-crimson/5 border border-neon-crimson/10 rounded-2xl transition-all hover:bg-neon-crimson/10"
          >
            <div className="min-w-0 flex-1 pr-3">
              <p className="font-bold text-sm text-slate-100 truncate">{anom.category}</p>
              <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                <span>Spent: <strong className="text-white">{formatCurrency(anom.currentAmount)}</strong></span>
                <span>•</span>
                <span>Normal: <span className="font-medium text-slate-450">{formatCurrency(anom.baselineAmount)}/mo</span></span>
              </p>
            </div>

            <div className="text-right shrink-0 flex flex-col items-end">
              <span className="text-xs font-black text-neon-crimson flex items-center gap-0.5">
                <TrendingUp size={12} />
                <span>+{anom.percentIncrease.toFixed(0)}%</span>
              </span>
              <span className="text-[10px] text-slate-500 mt-0.5 font-bold">+{formatCurrency(anom.increase)} over limit</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
