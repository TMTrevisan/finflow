import React, { useMemo, useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { formatCurrency, getCategoryEmoji } from '../utils/formatting';
import { Card, CardContent } from '../components/ui/Card';
import { SlidersHorizontal, ArrowUpRight, ArrowDownRight, Compass, Shield, Heart, PlusCircle } from 'lucide-react';
import { safeStorage } from '../utils/storage';
import { BottomSheet } from '../components/ui/BottomSheet';


export default function LifeOptimization() {
  const { transactions = [], categories = [], lifeOptimization = [], surplusMetrics, isLoading } = useAppContext();
  const [showConfig, setShowConfig] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeCategoryToMap, setActiveCategoryToMap] = useState(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);


  // Extract all distinct category names from transactions list
  const allCategories = useMemo(() => {
    const cats = new Set();
    transactions.forEach(t => {
      if (t.category) {
        cats.add(String(t.category));
      }
    });
    return Array.from(cats).sort();
  }, [transactions]);

  // Helper for initial category guessing/smart-defaults
  const guessClassification = (catName) => {
    if (!catName || typeof catName !== 'string') return 'Lifestyle';
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
      const cached = safeStorage.getItem('finflow_life_opt_mappings');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to parse cached mappings:', e);
    }
    return {};
  });

  // Compute status of mapping sync from Sheets
  const syncStatus = useMemo(() => {
    if (lifeOptimization && lifeOptimization.length > 0) {
      return {
        synced: true,
        source: "'Life_Optimization' Tiller Sheet",
        count: lifeOptimization.length
      };
    }
    
    if (categories && categories.length > 0) {
      const sample = categories[0];
      const keys = Object.keys(sample);
      const classKey = keys.find(k => 
        k.toLowerCase().includes('bucket') || 
        k.toLowerCase().includes('class') || 
        k.toLowerCase().includes('assignment')
      );
      if (classKey) {
        const mappedCount = categories.filter(c => c[classKey] !== undefined && c[classKey] !== null && String(c[classKey]).trim() !== '').length;
        return {
          synced: true,
          source: "custom columns in 'Categories' sheet",
          count: mappedCount || categories.length
        };
      }
    }
    
    return {
      synced: false
    };
  }, [lifeOptimization, categories]);

  // 1. Overwrite/hydrate local mappings if Tiller Sheet mapping is present
  useEffect(() => {
    // Collect rows from both lifeOptimization and categories that might contain classifications
    const sources = [];
    if (lifeOptimization && lifeOptimization.length > 0) {
      sources.push(...lifeOptimization);
    }
    if (categories && categories.length > 0) {
      sources.push(...categories);
    }

    if (sources.length > 0) {
      setMappings(prevMappings => {
        const newMappings = { ...prevMappings };
        let updated = false;

        sources.forEach(row => {
          const keys = Object.keys(row);
          const catKey = keys.find(k => k.toLowerCase().includes('category'));
          const classKey = keys.find(k => 
            k.toLowerCase().includes('bucket') || 
            k.toLowerCase().includes('class') || 
            k.toLowerCase().includes('assignment') || 
            k.toLowerCase().includes('type')
          );
          const inclKey = keys.find(k => 
            k.toLowerCase().includes('include') || 
            k.toLowerCase().includes('active') || 
            k.toLowerCase().includes('show')
          );

          if (catKey && (classKey || inclKey)) {
            const categoryName = String(row[catKey]).trim();
            if (categoryName) {
              // Casing-agnostic match
              const matchName = allCategories.find(c => String(c).toLowerCase().trim() === categoryName.toLowerCase()) || categoryName;

              let classification = newMappings[matchName]?.classification || 'Lifestyle';
              if (classKey && row[classKey] !== undefined && row[classKey] !== null && String(row[classKey]).trim() !== '') {
                const val = String(row[classKey]).trim().toLowerCase();
                if (val.includes('income')) classification = 'Income';
                else if (val.includes('compound') || val.includes('saving')) classification = 'Compounding';
                else if (val.includes('base') || val.includes('essential') || val.includes('fixed')) classification = 'Baseline';
                else if (val.includes('life') || val.includes('discretionary') || val.includes('style')) classification = 'Lifestyle';
              }

              let included = newMappings[matchName]?.included !== false; // default true
              if (inclKey && row[inclKey] !== undefined && row[inclKey] !== null && String(row[inclKey]).trim() !== '') {
                const val = String(row[inclKey]).trim().toLowerCase();
                if (val === 'false' || val === 'no' || val === '0' || val === 'hide' || val === 'unchecked' || val === 'exclude') {
                  included = false;
                } else if (val === 'true' || val === 'yes' || val === '1' || val === 'show' || val === 'checked' || val === 'include') {
                  included = true;
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
          safeStorage.setItem('finflow_life_opt_mappings', JSON.stringify(newMappings));
          return newMappings;
        }
        return prevMappings;
      });
    }
  }, [lifeOptimization, categories, allCategories]);

  // 2. Hydrate smart defaults for any new category seen that is not yet mapped
  useEffect(() => {
    setMappings(prevMappings => {
      let updated = false;
      const newMappings = { ...prevMappings };
      
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
        safeStorage.setItem('finflow_life_opt_mappings', JSON.stringify(newMappings));
        return newMappings;
      }
      return prevMappings;
    });
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
    safeStorage.setItem('finflow_life_opt_mappings', JSON.stringify(updated));
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
      const amountVal = Number(t.amount) || 0;

      if (classification === 'Income') {
        // Income is positive in standard reporting; positive amount adds to it, negative subtracts
        monthlyMap[monthKey].Income += amountVal;
      } else {
        // Tiller stores expenses as negative values. Negate them to display as positive spending totals.
        // Positive refunds/adjustments will correctly decrease this total.
        const netExpense = -amountVal;
        if (classification === 'Compounding') {
          monthlyMap[monthKey].Compounding += netExpense;
        } else if (classification === 'Baseline') {
          monthlyMap[monthKey].Baseline += netExpense;
        } else if (classification === 'Lifestyle') {
          monthlyMap[monthKey].Lifestyle += netExpense;
        }
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
      .sort((a, b) => b.monthKey.localeCompare(a.monthKey));
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
              {syncStatus.synced ? (
                <span className="inline-flex items-center text-[10px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-0.5 rounded-full">
                  ✓ Synced with {syncStatus.source} ({syncStatus.count} categories)
                </span>
              ) : (
                <span className="inline-flex items-center text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full">
                  ⚠️ No 'Life_Optimization' sheet or custom columns found. Using local browser config.
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

      {/* Real-time Surplus Engines Row */}
      {surplusMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card A: Rolling 30-Day Surplus */}
          <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-3.5 mb-4">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Rolling 30-Day Surplus</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                  <Heart className="text-neon-indigo animate-pulse" size={16} />
                  <span>Rolling 30-Day Surplus</span>
                </h3>
              </div>
              <span className="text-[9.5px] font-bold text-slate-400 bg-obsidian-800 border border-slate-700/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Time-Smooth</span>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculated by subtracting actual Baseline living costs and future Compounding savings from net Inflow over the last 30 days. Provides a real-time, backward-looking check on your discretionary spending rate.
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-455">Permission to Spend (last 30d):</span>
                <span className={`text-2xl font-black ${surplusMetrics.rolling.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(surplusMetrics.rolling.surplus)}
                </span>
              </div>
              
              <div className="w-full bg-obsidian-950 h-2 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-neon-indigo transition-all"
                  style={{ width: `${Math.min(100, (surplusMetrics.rolling.income / Math.max(surplusMetrics.rolling.income + surplusMetrics.rolling.baseline + surplusMetrics.rolling.compounding, 1)) * 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1.5 text-center">
                <div className="bg-[#0c0f16] border border-[#161B26] p-2 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Inflow</p>
                  <p className="text-xs font-bold text-slate-200 mt-1">{formatCurrency(surplusMetrics.rolling.income)}</p>
                </div>
                <div className="bg-[#0c0f16] border border-[#161B26] p-2 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Baseline</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">-{formatCurrency(surplusMetrics.rolling.baseline)}</p>
                </div>
                <div className="bg-[#0c0f16] border border-[#161B26] p-2 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Compound</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">-{formatCurrency(surplusMetrics.rolling.compounding)}</p>
                </div>
              </div>
              
              {surplusMetrics.rolling.surplus >= 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-[10px] font-bold text-emerald-400 flex items-center justify-center text-center">
                  ✓ Long-term goals fully funded. Discretionary cash cleared to spend guilt-free!
                </div>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl text-[10px] font-bold text-rose-400 flex items-center justify-center text-center">
                  ⚠️ Deficit over last 30 days. Recommend dialing back non-essential lifestyle purchases.
                </div>
              )}
            </div>
          </Card>

          {/* Card B: Blended Monthly Projections */}
          <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/40 pb-3.5 mb-4">
              <div>
                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Projected Monthly Budget</span>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5 mt-0.5">
                  <Shield className="text-neon-indigo" size={16} />
                  <span>Projected Monthly Budget</span>
                </h3>
              </div>
              <span className="text-[9.5px] font-bold text-slate-400 bg-obsidian-800 border border-slate-700/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">Forecast</span>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Calculated by blending actual month-to-date inflows/outflows with remaining envelope budget targets for the rest of the calendar month. Helps you anticipate month-end surplus.
              </p>
              <div className="flex items-baseline justify-between">
                <span className="text-xs text-slate-455">Projected final surplus (Budget + Actuals):</span>
                <span className={`text-2xl font-black ${surplusMetrics.projected.surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(surplusMetrics.projected.surplus)}
                </span>
              </div>

              <div className="w-full bg-obsidian-950 h-2 rounded-full overflow-hidden flex">
                <div 
                  className="h-full bg-neon-indigo transition-all"
                  style={{ width: `${Math.min(100, (surplusMetrics.projected.income / Math.max(surplusMetrics.projected.income + surplusMetrics.projected.baseline + surplusMetrics.projected.compounding, 1)) * 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-3 gap-2 pt-1.5 text-center">
                <div className="bg-[#0c0f16] border border-[#161B26] p-2 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Proj Income</p>
                  <p className="text-xs font-bold text-slate-200 mt-1">{formatCurrency(surplusMetrics.projected.income)}</p>
                </div>
                <div className="bg-[#0c0f16] border border-[#161B26] p-2 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Proj Baseline</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">-{formatCurrency(surplusMetrics.projected.baseline)}</p>
                </div>
                <div className="bg-[#0c0f16] border border-[#161B26] p-2 rounded-2xl">
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Proj Compound</p>
                  <p className="text-xs font-bold text-slate-400 mt-1">-{formatCurrency(surplusMetrics.projected.compounding)}</p>
                </div>
              </div>

              {surplusMetrics.projected.surplus >= 0 ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-[10px] font-bold text-emerald-400 flex items-center justify-center text-center">
                  ✓ Projected surplus is healthy. Month-end budget commitments fully secured.
                </div>
              ) : (
                <div className="bg-rose-500/10 border border-rose-500/20 p-3 rounded-2xl text-[10px] font-bold text-rose-400 flex items-center justify-center text-center">
                  ⚠️ Projected month-end deficit. Review budget categories for potential savings.
                </div>
              )}
            </div>
          </Card>
        </div>
      )}

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

                  {isMobile ? (
                    <button
                      type="button"
                      disabled={!mapping.included}
                      onClick={() => setActiveCategoryToMap(cat)}
                      className="bg-obsidian-800 border border-obsidian-750 text-slate-200 font-semibold rounded-lg px-2.5 py-1.5 text-[10px] disabled:opacity-30 disabled:cursor-not-allowed text-left flex items-center justify-between min-w-[100px]"
                    >
                      <span>
                        {mapping.classification === 'Income' && '💰 Income'}
                        {mapping.classification === 'Compounding' && '📈 Compounding'}
                        {mapping.classification === 'Baseline' && '🏠 Baseline'}
                        {mapping.classification === 'Lifestyle' && '🍔 Lifestyle'}
                      </span>
                    </button>
                  ) : (
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
                  )}

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

      <BottomSheet
        isOpen={activeCategoryToMap !== null}
        onClose={() => setActiveCategoryToMap(null)}
        title={`Classify ${activeCategoryToMap}`}
      >
        {activeCategoryToMap && (
          <div className="space-y-2">
            {[
              { value: 'Income', label: '💰 Income (Wages, dividends, payouts)' },
              { value: 'Compounding', label: '📈 Compounding (Retirement, investments, savings)' },
              { value: 'Baseline', label: '🏠 Baseline (Housing, groceries, bills)' },
              { value: 'Lifestyle', label: '🍔 Lifestyle (Dining, leisure, discretionary)' }
            ].map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  handleMappingChange(activeCategoryToMap, 'classification', opt.value);
                  setActiveCategoryToMap(null);
                }}
                className={`w-full text-left px-4 py-3.5 text-sm rounded-2xl transition-colors border ${
                  mappings[activeCategoryToMap]?.classification === opt.value
                    ? 'bg-neon-indigo/20 text-neon-indigo font-medium border-neon-indigo/35'
                    : 'bg-obsidian-800 text-slate-350 hover:bg-obsidian-700 hover:text-white border-obsidian-750'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
