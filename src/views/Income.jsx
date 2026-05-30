import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import DonutChart from '../components/ui/DonutChart';
import ContributionSplit from '../components/ui/ContributionSplit';
import DateRangeSelector from '../components/ui/DateRangeSelector';
import { filterTransactionsByDateRange } from '../utils/dateFilters';
import { formatCurrency, cleanMerchantName } from '../utils/formatting';
import { getCategoryConfig } from '../utils/categoryHelpers';
import { 
  TrendingUp, 
  Landmark, 
  CalendarCheck,
  FileDown,
  History
} from 'lucide-react';

export default function Income() {
  const { transactions = [], isLoading } = useAppContext();
  const [filterType, setFilterType] = useState('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Date filtered transactions
  const dateFilteredTransactions = useMemo(() => {
    return filterTransactionsByDateRange(transactions, filterType, customStart, customEnd);
  }, [transactions, filterType, customStart, customEnd]);

  // Filter transactions to only income (type === 'Income')
  const incomeTransactions = useMemo(() => {
    return dateFilteredTransactions.filter(t => t.type === 'Income');
  }, [dateFilteredTransactions]);

  // Overall income total
  const totalIncome = useMemo(() => {
    return incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [incomeTransactions]);

  // Group by Category for Donut Chart
  const categoryData = useMemo(() => {
    const categoriesMap = {};
    incomeTransactions.forEach(t => {
      const cat = t.category || 'Other Income';
      categoriesMap[cat] = (categoriesMap[cat] || 0) + t.amount;
    });

    return Object.entries(categoriesMap)
      .map(([name, value]) => {
        const config = getCategoryConfig(name);
        return {
          name,
          value,
          color: config.color
        };
      })
      .sort((a, b) => b.value - a.value);
  }, [incomeTransactions]);

  // Calculations for Monarch-style summary
  const summaryStats = useMemo(() => {
    if (incomeTransactions.length === 0) {
      return { total: 0, largest: 0, average: 0, count: 0 };
    }
    const count = incomeTransactions.length;
    const total = totalIncome;
    const average = total / count;
    const largest = Math.max(...incomeTransactions.map(t => t.amount));
    return { total, largest, average, count };
  }, [incomeTransactions, totalIncome]);

  // Group income transactions by Date for Recent Activity
  const groupedTransactionsByDate = useMemo(() => {
    const sorted = [...incomeTransactions].sort((a, b) => new Date(b.date) - new Date(a.date));
    
    const groups = {};
    sorted.forEach(t => {
      const dateStr = t.date;
      const dateObj = new Date(dateStr);
      // Format as "May 10" or invalid fallback
      const formattedDate = !isNaN(dateObj.getTime())
        ? dateObj.toLocaleDateString('default', { month: 'short', day: 'numeric', timeZone: 'UTC' })
        : 'Unknown Date';
      
      if (!groups[dateStr]) {
        groups[dateStr] = {
          dateLabel: formattedDate,
          rawDate: dateStr,
          transactions: [],
          totalAmount: 0
        };
      }
      groups[dateStr].transactions.push(t);
      groups[dateStr].totalAmount += t.amount;
    });
    
    return Object.values(groups).sort((a, b) => new Date(b.rawDate) - new Date(a.rawDate));
  }, [incomeTransactions]);

  // Group by Month/Day for historical chart
  const monthlyIncome = useMemo(() => {
    const isDaily = filterType === 'this_month' || filterType === 'last_month';
    const trendsMap = {};

    const targetTxns = isDaily ? dateFilteredTransactions : transactions;

    targetTxns
      .filter(t => t.type === 'Income')
      .forEach(t => {
        if (!t.date) return;
        const d = new Date(t.date);
        if (isNaN(d.getTime())) return;

        let key = '';
        if (isDaily) {
          key = String(t.date).substring(0, 10); // Ensure YYYY-MM-DD format
        } else {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          key = `${year}-${month}`; // YYYY-MM
        }
        trendsMap[key] = (trendsMap[key] || 0) + t.amount;
      });

    return Object.entries(trendsMap)
      .map(([label, total]) => {
        let displayLabel = label;
        if (isDaily) {
          const d = new Date(label + 'T00:00:00');
          if (isNaN(d.getTime())) {
            const parsed = new Date(label);
            displayLabel = isNaN(parsed.getTime()) ? label : parsed.toLocaleDateString('default', { month: 'short', day: 'numeric' });
          } else {
            displayLabel = d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
          }
        } else {
          const [year, month] = label.split('-');
          const d = new Date(Number(year), Number(month) - 1, 1);
          displayLabel = d.toLocaleDateString('default', { month: 'short', year: '2-digit' });
        }
        return { month: displayLabel, total, sortKey: label };
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [transactions, dateFilteredTransactions, filterType]);

  // CSV download function
  const downloadCSV = () => {
    if (incomeTransactions.length === 0) return;
    const headers = ['Date', 'Description', 'Category', 'Account', 'Amount'];
    const rows = incomeTransactions.map(t => [
      t.date,
      t.description,
      t.category || 'Other Income',
      t.account,
      t.amount
    ]);
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `finflow_income_${filterType}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-64 bg-obsidian-800 rounded-3xl w-full"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Date selector header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-obsidian-850 p-4 rounded-2xl border border-obsidian-800">
        <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Filtered View</h3>
        <DateRangeSelector
          filterType={filterType}
          setFilterType={setFilterType}
          customStart={customStart}
          setCustomStart={setCustomStart}
          customEnd={customEnd}
          setCustomEnd={setCustomEnd}
        />
      </div>

      {/* Dynamic Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-emerald/10 text-neon-emerald rounded-2xl">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Income</p>
            <p className="text-2xl font-bold text-white mt-1">{formatCurrency(totalIncome)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Selected range</p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-indigo/10 text-neon-indigo rounded-2xl">
            <Landmark size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Top Source</p>
            <p className="text-xl font-bold text-white mt-1">
              {categoryData[0]?.name || 'None'}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {categoryData[0] ? formatCurrency(categoryData[0].value) : '$0.00'} deposits
            </p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex items-center space-x-4">
          <div className="p-3 bg-neon-indigo/10 text-neon-indigo rounded-2xl">
            <CalendarCheck size={24} />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Deposits</p>
            <p className="text-2xl font-bold text-white mt-1">{incomeTransactions.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Credits processed</p>
          </div>
        </Card>
      </div>

      {/* Household Split Card */}
      <ContributionSplit transactions={incomeTransactions} />

      {/* Main Income Breakdown Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Segmented Donut Chart */}
        <Card className="lg:col-span-2 bg-obsidian-800/40 border-obsidian-800/80">
          <div className="p-6 border-b border-obsidian-800/80 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Income Distribution</h3>
          </div>
          <CardContent className="pt-6">
            <DonutChart 
              data={categoryData} 
              size={220} 
              centerLabel="Total Income"
              centerSublabel="This period"
              transactions={incomeTransactions}
            />
          </CardContent>
        </Card>

        {/* Monarch-style Summary Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80">
          <div className="p-6 border-b border-obsidian-800/80 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white">Summary</h3>
          </div>
          <CardContent className="pt-6 space-y-5">
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Total deposits</span>
              <span className="text-sm font-bold text-white">{summaryStats.count}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Largest deposit</span>
              <span className="text-sm font-bold text-white">{formatCurrency(summaryStats.largest)}</span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-sm text-slate-400 font-medium">Average deposit</span>
              <span className="text-sm font-bold text-white">{formatCurrency(summaryStats.average)}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-obsidian-750 pb-4">
              <span className="text-sm text-slate-400 font-medium">Total income</span>
              <span className="text-sm font-extrabold text-neon-emerald">{formatCurrency(summaryStats.total)}</span>
            </div>
            
            <button
              onClick={downloadCSV}
              disabled={incomeTransactions.length === 0}
              className="w-full flex items-center justify-center space-x-2 py-2.5 bg-obsidian-850 hover:bg-obsidian-750 border border-obsidian-750 rounded-xl text-xs font-bold text-slate-200 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <FileDown size={14} className="text-neon-indigo" />
              <span>Download CSV</span>
            </button>
          </CardContent>
        </Card>
      </div>

      {/* Monthly income trends */}
      <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6">
        <h3 className="text-lg font-bold text-white mb-6">Historical {filterType === 'this_month' || filterType === 'last_month' ? 'Daily' : 'Monthly'} Trends</h3>
        <div className="flex items-end justify-between gap-4 h-48 pt-6">
          {monthlyIncome.length === 0 ? (
            <p className="text-slate-500 text-sm text-center w-full">No historical income data</p>
          ) : (
            monthlyIncome.map((m) => {
              const maxMonth = Math.max(...monthlyIncome.map(x => x.total)) || 1;
              const heightPct = (m.total / maxMonth) * 100;
              
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center group h-full justify-end">
                  <div className="relative w-full flex items-end justify-center h-32 mb-2">
                    <span className="absolute bottom-full bg-obsidian-800 border border-obsidian-750 text-white font-bold text-[10px] px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none mb-1 shadow-xl z-10">
                      {formatCurrency(m.total)}
                    </span>
                    <div 
                      style={{ height: `${heightPct}%`, minHeight: '8%' }}
                      className="w-8 sm:w-16 bg-neon-emerald/25 hover:bg-neon-emerald/55 border border-neon-emerald/35 hover:border-neon-emerald rounded-t-lg transition-all duration-300 relative shadow-[0_0_12px_rgba(16,185,129,0.05)] hover:shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                    />
                  </div>
                  <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">{m.month}</span>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Recent Activity Section */}
      <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <History size={20} className="text-neon-indigo" />
          <span>Recent Activity</span>
        </h3>
        
        {groupedTransactionsByDate.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-6">No recent deposits found</p>
        ) : (
          <div className="space-y-6">
            {groupedTransactionsByDate.slice(0, 15).map(group => (
              <div key={group.rawDate} className="space-y-2.5">
                {/* Date Header with Daily Total */}
                <div className="flex justify-between items-center px-1 border-b border-obsidian-800/40 pb-1.5">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{group.dateLabel}</span>
                  <span className="text-xs font-bold text-neon-emerald">{formatCurrency(group.totalAmount)}</span>
                </div>
                
                {/* Transactions under this date */}
                <div className="divide-y divide-obsidian-800/40">
                   {group.transactions.map(t => {
                     const config = getCategoryConfig(t.category);
                     const IconComponent = config.icon;
                     
                     return (
                       <div 
                         key={t.id} 
                         className="flex items-center justify-between py-4.5 hover:bg-slate-800/10 px-3 rounded-2xl transition-all duration-150 group"
                       >
                         <div className="flex items-center space-x-4">
                           {/* Category Icon Circle */}
                           <div 
                             className="w-11 h-11 rounded-2xl flex items-center justify-center bg-obsidian-900 border transition-all duration-150"
                             style={{ 
                               borderColor: `${config.color}25`,
                             }}
                           >
                             {IconComponent && <IconComponent size={18} style={{ color: config.color }} />}
                           </div>
                           
                           <div>
                             <p className="text-base font-bold text-white tracking-tight group-hover:text-neon-indigo transition-colors duration-150">
                               {cleanMerchantName(t.description)}
                             </p>
                             <p className="text-xs text-slate-400 mt-1.5 flex items-center gap-2">
                               <span style={{ color: config.color }} className="font-bold">{t.category}</span>
                               <span className="text-slate-600 font-normal">•</span>
                               <span>{t.account}</span>
                             </p>
                           </div>
                         </div>
                         
                         <div className="text-right">
                           <span className="text-base font-black text-slate-100 group-hover:text-white transition-colors duration-150">
                             {formatCurrency(t.amount)}
                           </span>
                         </div>
                       </div>
                     );
                   })}
                 </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

