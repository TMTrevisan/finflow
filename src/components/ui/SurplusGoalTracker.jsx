import React, { useState } from 'react';
import { Card, CardContent } from './Card';
import { formatCurrency } from '../../utils/formatting';
import { Compass, Sparkles, CheckCircle, Flame } from 'lucide-react';

export default function SurplusGoalTracker({ surplusMetrics = {} }) {
  const [targetGoal, setTargetGoal] = useState(3000); // Configurable target: default $3000/mo
  
  const metrics = surplusMetrics?.rolling || { surplus: 0 };
  const surplus = Math.max(0, metrics.surplus);
  const progressPercent = Math.min(100, targetGoal > 0 ? (surplus / targetGoal) * 100 : 0);

  const statusInfo = () => {
    if (progressPercent >= 100) return { label: 'Goal Met!', color: 'text-neon-emerald', icon: CheckCircle };
    if (progressPercent >= 50) return { label: 'On Track', color: 'text-neon-indigo', icon: Flame };
    return { label: 'Accumulating', color: 'text-slate-400', icon: Compass };
  };

  const StatusIcon = statusInfo().icon;

  return (
    <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
          <Sparkles size={16} className="text-neon-indigo" />
          <span>Surplus Investment Goal</span>
        </h4>
        <div className="flex items-center space-x-1.5 bg-obsidian-900 border border-obsidian-800 px-2 py-0.5 rounded-full text-[10px] font-bold">
          <StatusIcon size={10} className={statusInfo().color} />
          <span className={statusInfo().color}>{statusInfo().label}</span>
        </div>
      </div>

      <div className="space-y-3">
        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs font-semibold">
            <span className="text-slate-400">Current Surplus: <strong className="text-white">{formatCurrency(surplus)}</strong></span>
            <span className="text-slate-500">Goal: {formatCurrency(targetGoal)}</span>
          </div>
          
          <div className="h-2 w-full bg-obsidian-900 rounded-full overflow-hidden">
            <div 
              style={{ width: `${progressPercent}%` }}
              className="h-full rounded-full bg-gradient-to-r from-neon-indigo to-neon-emerald transition-all duration-500"
            />
          </div>
        </div>

        {/* Dynamic target input config */}
        <div className="flex items-center justify-between pt-1 border-t border-obsidian-800/40 mt-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Adjust Monthly Target</label>
          <div className="flex items-center space-x-1">
            <span className="text-xs text-slate-400 font-bold">$</span>
            <input
              type="number"
              value={targetGoal}
              onChange={(e) => setTargetGoal(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 bg-obsidian-900 border border-obsidian-800 text-white font-bold rounded px-1 py-0.5 text-center text-xs focus:outline-none focus:border-neon-indigo"
            />
          </div>
        </div>
      </div>
    </Card>
  );
}
