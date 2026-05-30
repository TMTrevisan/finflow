import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import SankeyDiagram from '../components/diagrams/SankeyDiagram';
import DateRangeSelector from '../components/ui/DateRangeSelector';
import { filterTransactionsByDateRange } from '../utils/dateFilters';
import { formatCurrency } from '../utils/formatting';
import { Waves, Grid, CalendarDays, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { useWindowWidth } from '../utils/hooks';

export default function CashFlow() {
  const { transactions = [], isLoading } = useAppContext();
  const width = useWindowWidth();
  const [filterType, setFilterType] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [visualMode, setVisualMode] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 480 ? 'grid' : 'sankey'
  );
  const [activeSankeyFilter, setActiveSankeyFilter] = useState(null);

  // Date filtered transactions
  const dateFilteredTransactions = useMemo(() => {
    return filterTransactionsByDateRange(transactions, filterType, customStart, customEnd);
  }, [transactions, filterType, customStart, customEnd]);

  // Handle Sankey Node selection callback
  const handleSelectSankeyNode = (type, name) => {
    if (type === null) {
      setActiveSankeyFilter(null);
    } else {
      setActiveSankeyFilter({ type, name });
    }
  };

  // Re-filter transactions specifically for the dynamic drill-down list
  const sankeyFilteredTransactions = useMemo(() => {
    if (!activeSankeyFilter) return dateFilteredTransactions;
    const { type, name } = activeSankeyFilter;
    
    return dateFilteredTransactions.filter(t => {
      if (type === 'source') {
        return t.type === 'Income' && t.category === name;
      }
      if (type === 'pool') {
        return t.type === 'Income';
      }
      if (type === 'group') {
        if (name === 'Net Savings') {
          // Savings matches the net surplus from all accounts (Income minus expenses/transfers)
          return false;
        }
        return t.group === name;
      }
      if (type === 'category') {
        return t.category === name;
      }
      if (type === 'link') {
        const { source, target } = name;
        if (source === 'Total Income') {
          if (target === 'Net Savings') return false;
          return t.group === target;
        }
        if (target === 'Total Income') {
          return t.category === source && t.type === 'Income';
        }
        return t.group === source && t.category === target;
      }
      return true;
    });
  }, [dateFilteredTransactions, activeSankeyFilter]);

  // Reset active filter when date range changes
  useEffect(() => {
    setActiveSankeyFilter(null);
  }, [filterType, customStart, customEnd]);

  // Aggregate stats for summary cards
  const stats = useMemo(() => {
    const income = dateFilteredTransactions
      .filter(t => t.type === 'Income')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

    const expenses = dateFilteredTransactions
      .filter(t => (t.type === 'Expense' || t.type === 'Transfer') && 
                   t.group !== 'Investments' && 
                   t.group !== 'Wealth Building')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const investments = dateFilteredTransactions
      .filter(t => t.group === 'Investments' || t.group === 'Wealth Building')
      .reduce((sum, t) => sum + Math.abs(Number(t.amount) || 0), 0);

    const surplus = income - expenses;
    const savingsRate = income > 0 ? (surplus / income) * 100 : 0;

    return { 
      income, 
      expenses, 
      investments,
      surplus, 
      savingsRate: Math.max(0, Math.min(100, savingsRate))
    };
  }, [dateFilteredTransactions]);

  // Grouped Income Sources
  const incomeSources = useMemo(() => {
    const map = {};
    let total = 0;
    dateFilteredTransactions
      .filter(t => t.type === 'Income')
      .forEach(t => {
        const key = t.category || 'Uncategorized';
        const amount = Number(t.amount) || 0;
        map[key] = (map[key] || 0) + amount;
        total += amount;
      });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [dateFilteredTransactions]);

  // Grouped Expense Sources
  const expenseSources = useMemo(() => {
    const map = {};
    let total = 0;
    dateFilteredTransactions
      .filter(t => t.type === 'Expense' || (t.type === 'Transfer' && (t.group === 'Investments' || t.group === 'Cash Savings')))
      .forEach(t => {
        const key = t.category || 'Uncategorized';
        const amount = Math.abs(Number(t.amount) || 0);
        map[key] = (map[key] || 0) + amount;
        total += amount;
      });
    return Object.entries(map)
      .map(([name, value]) => ({
        name,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0
      }))
      .sort((a, b) => b.value - a.value);
  }, [dateFilteredTransactions]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="h-96 bg-obsidian-800 rounded-3xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filters & Control bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-obsidian-800 p-4 rounded-2xl border border-obsidian-750">
        <div className="flex items-center space-x-3">
          <DateRangeSelector
            filterType={filterType}
            setFilterType={setFilterType}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />
        </div>

        {/* Toggle visualizer */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="flex bg-obsidian-800 p-1 rounded-xl border border-obsidian-750">
            <button
              onClick={() => setVisualMode('sankey')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                visualMode === 'sankey' 
                  ? 'bg-neon-indigo/15 text-neon-indigo shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Waves size={14} />
              <span>Sankey Flow</span>
            </button>
            <button
              onClick={() => setVisualMode('grid')}
              className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                visualMode === 'grid' 
                  ? 'bg-neon-indigo/15 text-neon-indigo shadow' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Grid size={14} />
              <span>Grid Table</span>
            </button>
          </div>
          {width < 480 && visualMode === 'grid' && (
            <span className="text-[9px] text-slate-500 font-semibold italic text-center">
              💡 Tap "Sankey Flow" above to view flow diagram (best on desktop)
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#0B0E14] border border-[#161B26] p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-emerald mb-1">
            <ArrowUpRight size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inflow</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.income)}</p>
        </div>

        <div className="bg-[#0B0E14] border border-[#161B26] p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-crimson mb-1">
            <ArrowDownRight size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Outflow</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.expenses)}</p>
        </div>

        <div className="bg-[#0B0E14] border border-[#161B26] p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-emerald mb-1">
            <Waves size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Operating Surplus</span>
          </div>
          <p className={`text-xl font-bold ${stats.surplus >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
            {formatCurrency(stats.surplus)}
          </p>
        </div>

        <div className="bg-[#0B0E14] border border-[#161B26] p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-indigo mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-neon-indigo shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Invested & Saved</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.investments)}</p>
        </div>
      </div>

      {/* Main Flow content */}
      <div className="flex-1">
        {visualMode === 'sankey' ? (
          <SankeyDiagram transactions={dateFilteredTransactions} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start animate-fade-in">
            {/* Income Sources Card */}
            <Card className="bg-[#0B0E14] border border-[#161B26] p-6 flex flex-col rounded-3xl">
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
                <ArrowUpRight className="text-neon-emerald" /> Income Sources
              </h3>
              <div className="space-y-4 flex-1">
                {incomeSources.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-10">No income in this period</p>
                ) : (
                  incomeSources.map(source => (
                    <div key={source.name} className="space-y-1.5 pb-3 border-b border-obsidian-850 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">{source.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400 font-semibold">{source.percentage.toFixed(0)}%</span>
                          <span className="font-black text-neon-emerald">{formatCurrency(source.value)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-obsidian-950 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-neon-emerald"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Expenses Breakdown Card */}
            <Card className="bg-[#0B0E14] border border-[#161B26] p-6 flex flex-col rounded-3xl">
              <h3 className="text-base font-extrabold text-white mb-4 flex items-center gap-2">
                <ArrowDownRight className="text-neon-crimson" /> Expense Categories
              </h3>
              <div className="space-y-4 flex-1">
                {expenseSources.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-10">No expenses in this period</p>
                ) : (
                  expenseSources.map(source => (
                    <div key={source.name} className="space-y-1.5 pb-3 border-b border-obsidian-850 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-200">{source.name}</span>
                        <div className="flex items-center space-x-2">
                          <span className="text-slate-400 font-semibold">{source.percentage.toFixed(0)}%</span>
                          <span className="font-black text-slate-350">{formatCurrency(source.value)}</span>
                        </div>
                      </div>
                      <div className="h-1.5 w-full bg-obsidian-950 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full bg-neon-crimson"
                          style={{ width: `${source.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
