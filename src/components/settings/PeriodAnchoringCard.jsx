import React from 'react';
import { Card } from '../ui/Card';
import { Calendar } from 'lucide-react';

export default function PeriodAnchoringCard({ useCalendarToday, setUseCalendarToday }) {
  return (
    <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
            <Calendar size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Period Anchoring</h3>
            <p className="text-xs text-slate-500">Select how "this month" is defined for budgets and cash flow.</p>
          </div>
        </div>

        <div className="space-y-3">
          <label className="flex items-start space-x-3 bg-obsidian-800/30 p-3 rounded-xl border border-obsidian-850 cursor-pointer select-none">
            <input
              type="radio"
              name="period-anchor"
              checked={useCalendarToday}
              onChange={() => setUseCalendarToday(true)}
              className="mt-0.5 border-slate-700 text-neon-indigo focus:ring-neon-indigo bg-obsidian-800"
            />
            <div>
              <span className="text-xs font-bold text-white block">Use Calendar Month (Today)</span>
              <span className="text-[10px] text-slate-400">Anchor dates around the actual current calendar date ({new Date().toLocaleDateString()}).</span>
            </div>
          </label>

          <label className="flex items-start space-x-3 bg-obsidian-800/30 p-3 rounded-xl border border-obsidian-850 cursor-pointer select-none">
            <input
              type="radio"
              name="period-anchor"
              checked={!useCalendarToday}
              onChange={() => setUseCalendarToday(false)}
              className="mt-0.5 border-slate-700 text-neon-indigo focus:ring-neon-indigo bg-obsidian-800"
            />
            <div>
              <span className="text-xs font-bold text-white block">Use Latest Transaction Date</span>
              <span className="text-[10px] text-slate-400">Anchor dates around the latest transaction in your sheets (best for stale data).</span>
            </div>
          </label>
        </div>
      </div>
    </Card>
  );
}
