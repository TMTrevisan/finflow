import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import SankeyDiagram from '../components/diagrams/SankeyDiagram';
import { formatCurrency } from '../utils/formatting';
import { Waves, Grid, CalendarDays, ArrowUpRight, ArrowDownRight, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';

export default function CashFlow() {
  const { transactions, isLoading } = useAppContext();
  const [selectedMonth, setSelectedMonth] = useState('All');
  const [visualMode, setVisualMode] = useState('sankey'); // sankey, grid

  // Browser-independent month formatting helper
  const getMonthKey = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${month} '${year}`;
  };

  // Browser-independent month parsing helper for sorting
  const parseMonthKey = (key) => {
    if (key === 'All') return new Date(9999, 11, 31);
    const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
    const parts = key.split(" '");
    if (parts.length !== 2) return new Date(0);
    const m = months[parts[0]];
    const y = 2000 + parseInt(parts[1], 10);
    return new Date(y, m, 1);
  };

  // Extract unique months from transactions list for filtering
  const months = useMemo(() => {
    const monthSet = new Set();
    transactions.forEach(t => {
      const date = new Date(t.date);
      const m = getMonthKey(date);
      if (m !== 'Invalid Date') {
        monthSet.add(m);
      }
    });
    return ['All', ...Array.from(monthSet).sort((a, b) => {
      return parseMonthKey(b) - parseMonthKey(a); // reverse chronological
    })];
  }, [transactions]);

  // Aggregate stats for summary cards
  const stats = useMemo(() => {
    const periodTxns = selectedMonth === 'All' 
      ? transactions 
      : transactions.filter(t => getMonthKey(new Date(t.date)) === selectedMonth);

    const income = periodTxns.filter(t => t.type === 'Income').reduce((sum, t) => sum + t.amount, 0);
    const expenses = periodTxns.filter(t => t.type === 'Expense').reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const savings = Math.max(0, income - expenses);
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    return { income, expenses, savings, savingsRate };
  }, [transactions, selectedMonth]);

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-20 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="h-96 bg-obsidian-800 rounded-3xl w-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 flex flex-col h-full">
      {/* Filters & Control bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-obsidian-850 p-4 rounded-2xl border border-obsidian-800">
        <div className="flex items-center space-x-3">
          <CalendarDays size={18} className="text-slate-500" />
          <select
             value={selectedMonth}
             onChange={(e) => setSelectedMonth(e.target.value)}
             className="bg-obsidian-800 border border-obsidian-750 text-white rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 cursor-pointer"
          >
            {months.map(m => (
              <option key={m} value={m}>{m === 'All' ? 'All Months' : m}</option>
            ))}
          </select>
        </div>

        {/* Toggle visualizer */}
        <div className="flex bg-obsidian-800 p-1 rounded-xl border border-obsidian-750">
          <button
            onClick={() => setVisualMode('sankey')}
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
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
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              visualMode === 'grid' 
                ? 'bg-neon-indigo/15 text-neon-indigo shadow' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid size={14} />
            <span>Grid Table</span>
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-obsidian-800/30 border border-obsidian-800 p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-emerald mb-1">
            <ArrowUpRight size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inflow</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.income)}</p>
        </div>

        <div className="bg-obsidian-800/30 border border-obsidian-800 p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-crimson mb-1">
            <ArrowDownRight size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Outflow</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.expenses)}</p>
        </div>

        <div className="bg-obsidian-800/30 border border-obsidian-800 p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-indigo mb-1">
            <Waves size={16} />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Net Flow</span>
          </div>
          <p className="text-xl font-bold text-white">{formatCurrency(stats.income - stats.expenses)}</p>
        </div>

        <div className="bg-obsidian-800/30 border border-obsidian-800 p-4 rounded-2xl">
          <div className="flex items-center space-x-1.5 text-neon-emerald mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-neon-emerald shrink-0" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Savings Rate</span>
          </div>
          <p className="text-xl font-bold text-white">{stats.savingsRate.toFixed(1)}%</p>
        </div>
      </div>

      {/* Main Flow content */}
      <div className="flex-1">
        {visualMode === 'sankey' ? (
          <SankeyDiagram transactions={transactions} selectedMonth={selectedMonth} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Income Card */}
            <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ArrowUpRight className="text-neon-emerald" /> Income Inflow
              </h3>
              <div className="space-y-4 flex-1">
                {transactions
                  .filter(t => t.type === 'Income' && (selectedMonth === 'All' || getMonthKey(new Date(t.date)) === selectedMonth))
                  .map(t => (
                    <div key={t.id} className="flex justify-between items-center py-2 border-b border-obsidian-800/30">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{t.description}</p>
                        <p className="text-[10px] text-slate-500">{t.category} • {t.account}</p>
                      </div>
                      <span className="font-bold text-neon-emerald text-sm">{formatCurrency(t.amount)}</span>
                    </div>
                  ))}
              </div>
            </Card>

            {/* Expenses Card */}
            <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <ArrowDownRight className="text-neon-crimson" /> Expenses Outflow
              </h3>
              <div className="space-y-4 flex-1">
                {transactions
                  .filter(t => (t.type === 'Expense' || (t.type === 'Transfer' && (t.group === 'Investments' || t.group === 'Cash Savings'))) && (selectedMonth === 'All' || getMonthKey(new Date(t.date)) === selectedMonth))
                  .map(t => (
                    <div key={t.id} className="flex justify-between items-center py-2 border-b border-obsidian-800/30">
                      <div>
                        <p className="text-sm font-semibold text-slate-200">{t.description}</p>
                        <p className="text-[10px] text-slate-500">{t.category} • {t.account}</p>
                      </div>
                      <span className="font-bold text-slate-300 text-sm">{formatCurrency(Math.abs(t.amount))}</span>
                    </div>
                  ))}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
