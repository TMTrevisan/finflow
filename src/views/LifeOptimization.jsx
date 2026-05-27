import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, getCategoryEmoji } from '../utils/formatting';
import { Card, CardContent } from '../components/ui/Card';
import { SlidersHorizontal, ArrowUpRight, ArrowDownRight, Compass, Shield, Heart, PlusCircle } from 'lucide-react';

export default function LifeOptimization() {
  const { transactions = [], lifeOptimization = [], isLoading } = useAppContext();
  const [showConfig, setShowConfig] = useState(false);

  // Extract all distinct category names from transactions list
  const allCategories = useMemo(() => {
    const cats = new Set();
    transactions.forEach(t => {
      if (t.category) {
        cats.add(t.category);
      }
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Helper for initial category guessing/smart-defaults
  const guessClassification = (catName) => {
    const name = catName.toLowerCase();
    if (name.includes('paycheck') || name.includes('salary') || name.includes('bonus') || name.includes('dividend') || name.includes('interest') || name.includes('deposit') || name.includes('wages') || name.includes('family funding')) {
      return 'Income';
    }
    if (name.includes('401') || name.includes('ira') || name.includes('retirement') || name.includes('invest') || name.includes('savings') || name.includes('hsa') || name.includes('529') || name.includes('compounding') || name.includes('stock')) {
      return 'Compounding';
    }
    if (name.includes('grocer') || name.includes('rent') || name.includes('mortgage') || name.includes('utilit') || name.includes('electric') || name.includes('gas') || name.includes('water') || name.includes('power') || name.includes('internet') || name.includes('phone') || name.includes('insurance') || name.includes('medical') || name.includes('doctor') || name.includes('health') || name.includes('care') || name.includes('daycare') || name.includes('childcare')) {
      return 'Baseline';
    }
    return 'Lifestyle'; // fallback
  };

  // State to hold the mappings (classification & inclusion)
  const [mappings, setMappings] = useState(() => {
    try {
      const cached = localStorage.getItem('finflow_life_opt_mappings');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached mappings:', e);
    }
    return {};
  });

  // 1. Overwrite/hydrate local mappings if Tiller Sheet mapping is present
  useEffect(() => {
    if (lifeOptimization && lifeOptimization.length > 0) {
      const newMappings = { ...mappings };
      let updated = false;

      lifeOptimization.forEach(row => {
        const keys = Object.keys(row);
        const catKey = keys.find(k => k.toLowerCase().includes('category'));
        const classKey = keys.find(k => k.toLowerCase().includes('class') || k.toLowerCase().includes('type') || k.toLowerCase().includes('bucket'));
        const inclKey = keys.find(k => k.toLowerCase().includes('include') || k.toLowerCase().includes('active') || k.toLowerCase().includes('show'));

        if (catKey) {
          const categoryName = String(row[catKey]).trim();
          if (categoryName) {
            // Casing-agnostic match
            const matchName = allCategories.find(c => c.toLowerCase().trim() === categoryName.toLowerCase()) || categoryName;

            let classification = 'Lifestyle';
            if (classKey) {
              const val = String(row[classKey]).trim().toLowerCase();
              if (val.includes('income')) classification = 'Income';
              else if (val.includes('compound') || val.includes('saving')) classification = 'Compounding';
              else if (val.includes('base') || val.includes('essential') || val.includes('fixed')) classification = 'Baseline';
              else if (val.includes('life') || val.includes('discretionary') || val.includes('style')) classification = 'Lifestyle';
            }

            let included = true;
            if (inclKey) {
              const val = String(row[inclKey]).trim().toLowerCase();
              if (val === 'false' || val === 'no' || val === '0' || val === 'hide' || val === 'unchecked' || val === 'exclude') {
                included = false;
              }
            }

            if (!newMappings[matchName] || 
                newMappings[matchName].classification !== classification || 
                newMappings[matchName].included !== included) {
              newMappings[matchName] = { classification, included };
              updated = true;
            }
          }
        }
      });

      if (updated) {
        setMappings(newMappings);
        localStorage.setItem('finflow_life_opt_mappings', JSON.stringify(newMappings));
      }
    }
  }, [lifeOptimization, allCategories]);

  // 2. Hydrate smart defaults for any new category seen that is not yet mapped
  useEffect(() => {
    let updated = false;
    const newMappings = { ...mappings };
    
    allCategories.forEach(cat => {
      if (!newMappings[cat]) {
        newMappings[cat] = {
          classification: guessClassification(cat),
          included: cat.toLowerCase().includes('transfer') || cat.toLowerCase().includes('payment') ? false : true
        };
        updated = true;
      }
    });

    if (updated) {
      setMappings(newMappings);
      localStorage.setItem('finflow_life_opt_mappings', JSON.stringify(newMappings));
    }
  }, [allCategories]);

  // Handle updates to category mappings
  const handleMappingChange = (category, field, value) => {
    const updated = {
      ...mappings,
      [category]: {
        ...mappings[category],
        [field]: value
      }
    };
    setMappings(updated);
    localStorage.setItem('finflow_life_opt_mappings', JSON.stringify(updated));
  };

  // Math Engine: Group transactions by Month and calculate functional bucket sums
  const monthlyMatrixData = useMemo(() => {
    if (transactions.length === 0) return [];

    const monthlyMap = {};

    transactions.forEach(t => {
      if (!t.date || !t.category) return;
      
      const mapping = mappings[t.category];
      // Skip if category is explicitly unchecked or excluded
      if (mapping && !mapping.included) return;

      const dateObj = new Date(t.date);
      if (isNaN(dateObj.getTime())) return;

      // Group key as YYYY-MM
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${month}`;

      if (!monthlyMap[monthKey]) {
        monthlyMap[monthKey] = {
          monthKey,
          displayMonth: dateObj.toLocaleDateString('default', { month: 'short', year: '2-digit' }),
          Income: 0,
          Compounding: 0,
          Baseline: 0,
          Lifestyle: 0
        };
      }

      const classification = mapping ? mapping.classification : guessClassification(t.category);
      const absAmount = Math.abs(Number(t.amount) || 0);

      if (classification === 'Income') {
        monthlyMap[monthKey].Income += absAmount;
      } else if (classification === 'Compounding') {
        monthlyMap[monthKey].Compounding += absAmount;
      } else if (classification === 'Baseline') {
        monthlyMap[monthKey].Baseline += absAmount;
      } else if (classification === 'Lifestyle') {
        monthlyMap[monthKey].Lifestyle += absAmount;
      }
    });

    // Convert map to sorted list and calculate Surplus
    return Object.values(monthlyMap)
      .map(row => {
        const surplus = row.Income - row.Compounding - row.Baseline;
        return {
          ...row,
          surplus
        };
      })
      .sort((a, b) => a.monthKey.localeCompare(b.monthKey));
  }, [transactions, mappings]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-64 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="h-96 bg-obsidian-800 rounded-3xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header Introduction card */}
      <div className="bg-gradient-to-br from-[#0e1629] to-[#080d1a] border border-obsidian-800 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Compass className="text-neon-indigo animate-spin-slow" size={22} />
              <span>Permission to Spend Engine</span>
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              Moving past historical tracking to isolate **Surplus (Permission to Spend)**. 
              When Surplus is positive, your baseline living costs and future compounding security are fully funded. 
              You are officially cleared to spend remaining discretionary cash on high-value life upgrades guilt-free.
            </p>
            <div className="flex flex-wrap gap-2 mt-2">
              {lifeOptimization && lifeOptimization.length > 0 ? (
                <span className="inline-flex items-center text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full">
                  ✓ Synced with 'Life_Optimization' Tiller Sheet ({lifeOptimization.length} categories)
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full">
                  ⚠️ No 'Life_Optimization' sheet found. Using local browser config.
                </span>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowConfig(c => !c)}
            className="flex items-center space-x-1.5 px-4 py-2 bg-obsidian-800 hover:bg-obsidian-700 border border-obsidian-750 rounded-xl text-xs font-bold text-slate-200 transition-all cursor-pointer shrink-0"
          >
            <SlidersHorizontal size={14} />
            <span>{showConfig ? 'Hide Category Mapping' : 'Manage Category Mapping'}</span>
          </button>
        </div>
      </div>

      {/* Control Plane Section: Category Assignments */}
      {showConfig && (
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Category Classification Mapping</h3>
            <p className="text-[10px] text-slate-500 mt-1">Map each category to a behavioral classification or toggle inclusion to filter it from calculations.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[360px] overflow-y-auto pr-2 custom-scrollbar">
            {allCategories.map(cat => {
              const mapping = mappings[cat] || { classification: 'Lifestyle', included: true };
              return (
                <div key={cat} className="flex items-center justify-between p-3 bg-obsidian-900 border border-obsidian-800 rounded-2xl gap-2 hover:border-obsidian-750 transition-colors">
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={mapping.included}
                      onChange={(e) => handleMappingChange(cat, 'included', e.target.checked)}
                      className="w-4 h-4 rounded border-slate-700 bg-obsidian-800 text-neon-indigo focus:ring-neon-indigo/50 cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-300 truncate">{getCategoryEmoji(cat)} {cat}</span>
                  </div>

                  <select
                    value={mapping.classification}
                    disabled={!mapping.included}
                    onChange={(e) => handleMappingChange(cat, 'classification', e.target.value)}
                    className="bg-obsidian-800 border border-obsidian-750 text-slate-200 font-semibold rounded-lg px-2 py-1 text-[10px] focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <option value="Income">💰 Income</option>
                    <option value="Compounding">📈 Compounding</option>
                    <option value="Baseline">🏠 Baseline</option>
                    <option value="Lifestyle">🍔 Lifestyle</option>
                  </select>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Historical Monthly surplus matrix */}
      <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800/60">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Historical Monthly Analytics Matrix</h3>
          <p className="text-[10px] text-slate-500 mt-1">Calculates total absolute cash flow volumes per behavioral bucket month-over-month.</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#161B26] bg-[#0d121c] font-semibold text-slate-400 text-xs">
                <th className="px-6 py-4 font-bold uppercase tracking-wider text-slate-500">Month</th>
                <th className="px-4 py-4 text-right font-bold uppercase tracking-wider text-slate-400">Total Income</th>
                <th className="px-4 py-4 text-right font-bold uppercase tracking-wider text-slate-400">Compounding (Future)</th>
                <th className="px-4 py-4 text-right font-bold uppercase tracking-wider text-slate-400">Baseline (Essentials)</th>
                <th className="px-4 py-4 text-right font-bold uppercase tracking-wider text-slate-400">Lifestyle (Discretionary)</th>
                <th className="px-6 py-4 text-right font-bold uppercase tracking-wider text-slate-300">Surplus</th>
              </tr>
            </thead>

            <tbody className="text-xs divide-y divide-slate-850/40">
              {monthlyMatrixData.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-500 font-semibold">
                    No transactions matching configuration mapping found.
                  </td>
                </tr>
              ) : (
                monthlyMatrixData.map(row => {
                  const isSurplusPositive = row.surplus > 0;
                  return (
                    <tr key={row.monthKey} className="hover:bg-slate-800/10 transition-colors">
                      <td className="px-6 py-4 font-bold text-white text-sm">{row.displayMonth}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-200">{formatCurrency(row.Income)}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-400">{formatCurrency(row.Compounding)}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-400">{formatCurrency(row.Baseline)}</td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-455">{formatCurrency(row.Lifestyle)}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-sm transition-all border ${
                          isSurplusPositive
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                          {isSurplusPositive ? '✓ ' : '✗ '}{formatCurrency(row.surplus)}
                          {isSurplusPositive && (
                            <span className="text-[9px] uppercase tracking-wider font-bold bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded-full shrink-0">Clear to Spend</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
