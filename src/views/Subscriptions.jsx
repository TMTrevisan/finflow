import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { formatCurrency, formatDate, cleanMerchantName, getCategoryEmoji } from '../utils/formatting';
import { 
  CalendarRange, 
  CreditCard, 
  ChevronLeft, 
  ChevronRight, 
  AlertCircle, 
  DollarSign, 
  TrendingUp, 
  Sparkles,
  Calendar as CalendarIcon,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function Subscriptions() {
  const { transactions } = useAppContext();
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth()); // 0-indexed
  const [selectedDaySubscriptions, setSelectedDaySubscriptions] = useState(null);

  // Month names
  const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // 1. Detect Subscriptions using transaction history
  const subscriptions = useMemo(() => {
    const expenses = transactions.filter(t => t.amount < 0);
    const merchantGroups = {};

    expenses.forEach(t => {
      const cleanName = cleanMerchantName(t.description);
      if (!cleanName) return;
      if (!merchantGroups[cleanName]) {
        merchantGroups[cleanName] = [];
      }
      merchantGroups[cleanName].push(t);
    });

    const list = [];

    Object.entries(merchantGroups).forEach(([merchant, txns]) => {
      // Need at least 2 occurrences to calculate gaps
      if (txns.length < 2) return;

      // Sort oldest to newest
      const sorted = [...txns].sort((a, b) => new Date(a.date) - new Date(b.date));

      // Calculate gaps in days
      const gaps = [];
      for (let i = 1; i < sorted.length; i++) {
        const d1 = new Date(sorted[i-1].date);
        const d2 = new Date(sorted[i].date);
        const gap = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
        gaps.push(gap);
      }

      const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
      const variance = gaps.reduce((sum, g) => sum + Math.pow(g - avgGap, 2), 0) / gaps.length;
      const stdDev = Math.sqrt(variance);

      // Map average gap to regular subscription frequencies
      let frequency = '';
      let intervalDays = 0;
      if (avgGap >= 5 && avgGap <= 9) {
        frequency = 'Weekly';
        intervalDays = 7;
      } else if (avgGap >= 11 && avgGap <= 17) {
        frequency = 'Bi-weekly';
        intervalDays = 14;
      } else if (avgGap >= 25 && avgGap <= 35) {
        frequency = 'Monthly';
        intervalDays = 30;
      } else if (avgGap >= 80 && avgGap <= 100) {
        frequency = 'Quarterly';
        intervalDays = 90;
      } else if (avgGap >= 340 && avgGap <= 380) {
        frequency = 'Annually';
        intervalDays = 365;
      }

      // Validate gap consistency (stdDev under 5 days, or under 15% of interval)
      const isConsistent = frequency !== '' && (stdDev < 5 || stdDev / intervalDays < 0.15);

      if (isConsistent) {
        const avgAmount = Math.abs(sorted.reduce((sum, t) => sum + t.amount, 0) / sorted.length);
        const latestTxn = sorted[sorted.length - 1];
        const latestDate = new Date(latestTxn.date);

        // Status calculation: active if latest txn was within (intervalDays + 15) days of today
        const today = new Date();
        const daysSinceLast = Math.round((today - latestDate) / (1000 * 60 * 60 * 24));
        const status = daysSinceLast <= (intervalDays + 15) ? 'Active' : 'Canceled';

        // Calculate next projected bill date
        const nextBillDate = new Date(latestDate);
        nextBillDate.setDate(nextBillDate.getDate() + intervalDays);
        
        // Advance next bill date if in the past for active subs
        while (nextBillDate < today && status === 'Active') {
          nextBillDate.setDate(nextBillDate.getDate() + intervalDays);
        }

        list.push({
          merchant,
          frequency,
          intervalDays,
          amount: avgAmount,
          lastPaidDate: latestTxn.date,
          nextBillDate: nextBillDate.toISOString().split('T')[0],
          status,
          category: latestTxn.category,
          account: latestTxn.account
        });
      }
    });

    // Sort active subscriptions by amount descending
    return list.sort((a, b) => b.amount - a.amount);
  }, [transactions]);

  // 2. Metrics calculation
  const metrics = useMemo(() => {
    const activeSubs = subscriptions.filter(s => s.status === 'Active');
    
    let monthlyBurn = 0;
    activeSubs.forEach(s => {
      if (s.frequency === 'Weekly') monthlyBurn += s.amount * 4.33;
      else if (s.frequency === 'Bi-weekly') monthlyBurn += s.amount * 2.16;
      else if (s.frequency === 'Monthly') monthlyBurn += s.amount;
      else if (s.frequency === 'Quarterly') monthlyBurn += s.amount / 3;
      else if (s.frequency === 'Annually') monthlyBurn += s.amount / 12;
    });

    const annualBurn = monthlyBurn * 12;
    const activeCount = activeSubs.length;
    const expensiveSub = activeSubs.length > 0 ? activeSubs[0] : null;

    return {
      monthlyBurn,
      annualBurn,
      activeCount,
      expensiveSub
    };
  }, [subscriptions]);

  // 3. Calendar helpers
  const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay(); // 0 is Sunday

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

  // Map active subscriptions to their expected billing day in the current viewing month
  const calendarBills = useMemo(() => {
    const billsMap = {};
    const activeSubs = subscriptions.filter(s => s.status === 'Active');

    activeSubs.forEach(sub => {
      const nextBill = new Date(sub.nextBillDate);
      
      // Project the bill date into the selected calendar month/year
      // If it's a monthly subscription, it happens on the same day-of-month every month
      let targetDay = null;

      if (sub.frequency === 'Monthly') {
        const dayOfMonth = new Date(sub.lastPaidDate).getDate();
        // Cap day of month at the maximum days of the current viewing month
        targetDay = Math.min(dayOfMonth, daysInMonth);
      } else {
        // For weekly, bi-weekly, or quarterly/annual, check if the calculated nextBillDate falls in the target month
        if (nextBill.getFullYear() === currentYear && nextBill.getMonth() === currentMonth) {
          targetDay = nextBill.getDate();
        }
      }

      if (targetDay !== null) {
        if (!billsMap[targetDay]) {
          billsMap[targetDay] = [];
        }
        billsMap[targetDay].push(sub);
      }
    });

    return billsMap;
  }, [subscriptions, currentYear, currentMonth, daysInMonth]);

  const handlePrevMonth = () => {
    setSelectedDaySubscriptions(null);
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    setSelectedDaySubscriptions(null);
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl pb-12">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white font-display">Subscriptions</h1>
          <p className="text-sm text-slate-400">Smart detector analyzing recurring charges, subscription burn, and billing schedules.</p>
        </div>
        <div className="flex items-center space-x-2 bg-obsidian-800/80 px-4 py-2 rounded-2xl border border-obsidian-750">
          <CalendarRange size={16} className="text-neon-indigo" />
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{subscriptions.filter(s => s.status === 'Active').length} Active Services</span>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Monthly Burn Rate</span>
            <div className="p-1.5 bg-neon-crimson/10 rounded-lg text-neon-crimson">
              <TrendingUp size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white">{formatCurrency(metrics.monthlyBurn)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Average spent on recurring services monthly</p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Annual Projection</span>
            <div className="p-1.5 bg-neon-indigo/10 rounded-lg text-neon-indigo">
              <DollarSign size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white">{formatCurrency(metrics.annualBurn)}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Total projected cost over 12 months</p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active Services</span>
            <div className="p-1.5 bg-neon-emerald/10 rounded-lg text-neon-emerald">
              <CheckCircle2 size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-black text-white">{metrics.activeCount}</h3>
            <p className="text-[10px] text-slate-500 mt-1">Active subscriptions detected in system</p>
          </div>
        </Card>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Top Cost Subscription</span>
            <div className="p-1.5 bg-neon-indigo/10 rounded-lg text-neon-indigo">
              <Sparkles size={14} />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-base font-bold text-white truncate">
              {metrics.expensiveSub ? metrics.expensiveSub.merchant : 'None'}
            </h3>
            <p className="text-xs font-semibold text-neon-crimson mt-0.5">
              {metrics.expensiveSub ? `${formatCurrency(metrics.expensiveSub.amount)} / ${metrics.expensiveSub.frequency}` : 'No active subscriptions'}
            </p>
          </div>
        </Card>
      </div>

      {/* Main Grid: Left List, Right Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Subscriptions List (Left Column) */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 lg:col-span-7 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-white">Detected Services</h2>
            <p className="text-xs text-slate-400">Review your recurring liabilities grouped from transaction histories.</p>
          </div>

          <div className="overflow-x-auto">
            {subscriptions.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-2 border border-dashed border-obsidian-750 rounded-2xl bg-obsidian-900/20">
                <AlertCircle size={28} className="text-slate-500" />
                <p className="text-xs font-semibold text-slate-400">No recurring subscriptions detected.</p>
                <p className="text-[10px] text-slate-500 max-w-xs">Make sure your Google Sheets imports contain repeating transactions with regular intervals.</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-obsidian-800 text-slate-400 font-semibold">
                    <th className="pb-3 pr-2">Service</th>
                    <th className="pb-3 px-2">Cost</th>
                    <th className="pb-3 px-2">Frequency</th>
                    <th className="pb-3 px-2 hidden sm:table-cell">Next Bill</th>
                    <th className="pb-3 pl-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-800/50">
                  {subscriptions.map((sub, idx) => (
                    <tr key={idx} className="hover:bg-obsidian-800/25 transition-colors group">
                      <td className="py-3.5 pr-2 flex items-center space-x-2.5">
                        <span className="text-base select-none shrink-0">{getCategoryEmoji(sub.category)}</span>
                        <div className="truncate">
                          <p className="font-bold text-slate-100 group-hover:text-white truncate">{sub.merchant}</p>
                          <p className="text-[10px] text-slate-500 truncate">{sub.account}</p>
                        </div>
                      </td>
                      <td className="py-3.5 px-2 font-bold text-slate-100">
                        {formatCurrency(sub.amount)}
                      </td>
                      <td className="py-3.5 px-2">
                        <span className="text-[10px] font-semibold text-slate-400 bg-obsidian-800/70 border border-obsidian-700/60 px-2 py-0.5 rounded-full capitalize">
                          {sub.frequency}
                        </span>
                      </td>
                      <td className="py-3.5 px-2 text-slate-400 hidden sm:table-cell">
                        {sub.status === 'Active' ? formatDate(sub.nextBillDate) : '—'}
                      </td>
                      <td className="py-3.5 pl-2">
                        <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
                          sub.status === 'Active'
                            ? 'bg-neon-emerald/10 text-neon-emerald border-neon-emerald/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-700/20'
                        }`}>
                          {sub.status === 'Active' ? (
                            <>
                              <span className="w-1 h-1 rounded-full bg-neon-emerald animate-ping" />
                              <span>Active</span>
                            </>
                          ) : (
                            <span>Canceled</span>
                          )}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>

        {/* Forecast Calendar (Right Column) */}
        <div className="lg:col-span-5 space-y-4">
          <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-obsidian-800/60 pb-3">
              <div>
                <h2 className="text-lg font-bold text-white">Billing Calendar</h2>
                <p className="text-xs text-slate-400">Weekly and monthly billing forecasts.</p>
              </div>
              
              {/* Calendar Selector */}
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handlePrevMonth}
                  className="p-1.5 bg-obsidian-850 hover:bg-obsidian-750 text-slate-400 hover:text-white rounded-lg transition-colors border border-obsidian-750"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider min-w-[90px] text-center">
                  {MONTHS[currentMonth]} {currentYear}
                </span>
                <button 
                  onClick={handleNextMonth}
                  className="p-1.5 bg-obsidian-850 hover:bg-obsidian-750 text-slate-400 hover:text-white rounded-lg transition-colors border border-obsidian-750"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            {/* Calendar Layout */}
            <div className="space-y-4">
              {/* Weekdays Row */}
              <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
                  <div key={i} className="py-1">{d}</div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-1.5">
                {/* Empty spacers for first week offset */}
                {Array.from({ length: firstDayIndex }).map((_, i) => (
                  <div key={`empty-${i}`} className="aspect-square bg-transparent rounded-lg" />
                ))}

                {/* Days of Month */}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1;
                  const dayBills = calendarBills[day] || [];
                  const hasBills = dayBills.length > 0;
                  const isToday = new Date().getDate() === day && new Date().getMonth() === currentMonth && new Date().getFullYear() === currentYear;

                  return (
                    <button
                      key={`day-${day}`}
                      onClick={() => hasBills ? setSelectedDaySubscriptions({ day, bills: dayBills }) : null}
                      disabled={!hasBills}
                      className={`relative aspect-square flex flex-col items-center justify-center rounded-xl transition-all border ${
                        hasBills 
                          ? 'bg-neon-indigo/5 border-neon-indigo/35 hover:bg-neon-indigo/15 active:scale-95 shadow-sm cursor-pointer'
                          : 'bg-obsidian-900/10 border-obsidian-850/40 text-slate-650 cursor-default'
                      } ${isToday ? 'ring-1.5 ring-white/50 border-white/20' : ''}`}
                    >
                      <span className={`text-xs font-bold ${
                        hasBills 
                          ? 'text-neon-indigo font-black' 
                          : 'text-slate-500'
                      }`}>
                        {day}
                      </span>
                      
                      {/* Dots indicating bills */}
                      {hasBills && (
                        <div className="absolute bottom-1 flex justify-center space-x-0.5">
                          {dayBills.slice(0, 3).map((_, dotIdx) => (
                            <span 
                              key={dotIdx} 
                              className="w-1 h-1 rounded-full bg-neon-indigo shadow-glow animate-pulse" 
                            />
                          ))}
                          {dayBills.length > 3 && (
                            <span className="w-1 h-1 bg-white rounded-full" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Dialog overlay for selected day's bills */}
          {selectedDaySubscriptions && (
            <Card className="bg-obsidian-800/90 border-neon-indigo/30 p-5 space-y-3 relative overflow-hidden backdrop-blur shadow-2xl">
              <div className="absolute top-0 right-0 p-2">
                <button 
                  onClick={() => setSelectedDaySubscriptions(null)}
                  className="text-slate-500 hover:text-slate-300 p-1 transition-colors"
                >
                  <XCircle size={18} />
                </button>
              </div>

              <div>
                <h3 className="text-sm font-bold text-white flex items-center space-x-1.5">
                  <CalendarIcon size={14} className="text-neon-indigo" />
                  <span>Bills Due on {MONTHS[currentMonth]} {selectedDaySubscriptions.day}</span>
                </h3>
                <p className="text-[10px] text-slate-400">Projected costs due on this date.</p>
              </div>

              <div className="space-y-2 mt-2 max-h-[180px] overflow-y-auto pr-1">
                {selectedDaySubscriptions.bills.map((sub, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2.5 bg-obsidian-900/60 rounded-xl border border-obsidian-750">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm shrink-0">{getCategoryEmoji(sub.category)}</span>
                      <div className="truncate">
                        <p className="text-xs font-bold text-slate-100 truncate">{sub.merchant}</p>
                        <p className="text-[9px] text-slate-500 truncate">{sub.frequency}</p>
                      </div>
                    </div>
                    <span className="text-xs font-extrabold text-neon-crimson">
                      {formatCurrency(sub.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
