import React from 'react';
import { Card } from '../ui/Card';
import { Sliders } from 'lucide-react';

export default function AdvancedFeaturesCard({
  enableCustomSplits,
  setEnableCustomSplits,
  partnerAName,
  setPartnerAName,
  partnerBName,
  setPartnerBName,
  partnerAEmployer,
  setPartnerAEmployer,
  partnerBEmployer,
  setPartnerBEmployer
}) {
  return (
    <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
            <Sliders size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Advanced Features</h3>
            <p className="text-xs text-slate-500">Toggle personalized views and custom splitting configurations.</p>
          </div>
        </div>

        <div className="space-y-4">
          <label className="flex items-start space-x-3 bg-obsidian-800/30 p-3 rounded-xl border border-obsidian-850 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={enableCustomSplits}
              onChange={(e) => setEnableCustomSplits(e.target.checked)}
              className="mt-1 border-slate-700 rounded text-neon-indigo focus:ring-neon-indigo bg-obsidian-800"
            />
            <div>
              <span className="text-xs font-bold text-white block">Custom Income Split Mode</span>
              <span className="text-[10px] text-slate-400">
                Enable specific calculations, custom payroll merchant cleanup, and the Contributions & Surplus planning dashboard.
              </span>
            </div>
          </label>

          {/* Partner configuration inputs */}
          <div className="border-t border-obsidian-800 pt-3 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Label Settings</h4>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner A Name</label>
                <input
                  type="text"
                  value={partnerAName}
                  placeholder={enableCustomSplits ? 'Kaitlyn' : 'Wife'}
                  onChange={(e) => setPartnerAName(e.target.value)}
                  className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner B Name</label>
                <input
                  type="text"
                  value={partnerBName}
                  placeholder={enableCustomSplits ? 'Todd' : 'Husband'}
                  onChange={(e) => setPartnerBName(e.target.value)}
                  className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner A Employer / Tag</label>
                <input
                  type="text"
                  value={partnerAEmployer}
                  placeholder={enableCustomSplits ? 'Havas' : 'Employer A'}
                  onChange={(e) => setPartnerAEmployer(e.target.value)}
                  className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner B Employer / Tag</label>
                <input
                  type="text"
                  value={partnerBEmployer}
                  placeholder={enableCustomSplits ? 'BD' : 'Employer B'}
                  onChange={(e) => setPartnerBEmployer(e.target.value)}
                  className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
