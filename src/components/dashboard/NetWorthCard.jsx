import React, { useMemo, useState, useEffect } from 'react';
import LineChart from '../ui/LineChart';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { formatCurrency } from '../../utils/formatting';

export default function NetWorthCard({ balances = [], totals = {} }) {
  const [metric, setMetric] = useState('history'); // 'history', 'assets', 'debts'
  const [chartHeight, setChartHeight] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth < 640 ? 60 : 85
  );
  const [showChart, setShowChart] = useState(() => 
    typeof window !== 'undefined' && window.innerWidth >= 640
  );

  useEffect(() => {
    const handleResize = () => {
      setChartHeight(window.innerWidth < 640 ? 60 : 85);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Calculate Net Worth / Assets / Liabilities history for Line Chart
  const historyData = useMemo(() => {
    const uniqueDates = Array.from(new Set((balances || []).filter(b => b && b.date).map(b => b.date))).sort(
      (a, b) => new Date(a) - new Date(b)
    );

    let targetDates = [];
    const isDownsampled = uniqueDates.length > 12;
    if (isDownsampled) {
      const monthlyGroups = {};
      uniqueDates.forEach(date => {
        const key = date.substring(0, 7); // YYYY-MM
        if (!monthlyGroups[key]) {
          monthlyGroups[key] = [];
        }
        monthlyGroups[key].push(date);
      });
      
      const sortedMonths = Object.keys(monthlyGroups).sort();
      sortedMonths.forEach(m => {
        const datesInMonth = monthlyGroups[m].sort();
        targetDates.push(datesInMonth[datesInMonth.length - 1]);
      });
      
      if (targetDates.length > 36) {
        targetDates = targetDates.slice(-36);
      }
    } else {
      targetDates = uniqueDates;
    }

    return targetDates.map(date => {
      let assetsSum = 0;
      let liabilitiesSum = 0;

      const dateBalances = (balances || []).filter(b => b && b.date === date);
      const map = new Map();
      dateBalances.forEach(b => {
        if (b && b.institution && b.account) {
          const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
          map.set(key, b);
        }
      });

      Array.from(map.values()).forEach(b => {
        if (!b) return;
        const val = Number(b.balance) || 0;
        if (b.class === 'Asset') {
          assetsSum += val;
        } else if (b.class === 'Liability') {
          liabilitiesSum += Math.abs(val);
        }
      });

      let chartVal = 0;
      if (metric === 'history') {
        chartVal = assetsSum - liabilitiesSum;
      } else if (metric === 'assets') {
        chartVal = assetsSum;
      } else if (metric === 'debts') {
        chartVal = liabilitiesSum;
      }

      const dObj = String(date).includes('T') ? new Date(date) : new Date(date + 'T00:00:00');
      const label = isNaN(dObj.getTime())
        ? date
        : isDownsampled
          ? dObj.toLocaleDateString('default', { month: 'short', year: '2-digit', timeZone: 'UTC' })
          : dObj.toLocaleDateString('default', { month: 'short', day: 'numeric', timeZone: 'UTC' });

      return {
        date: label,
        rawDate: date,
        netWorth: chartVal,
        assets: assetsSum,
        liabilities: liabilitiesSum
      };
    });
  }, [balances, metric]);

  const activeValue = useMemo(() => {
    if (metric === 'assets') return totals.assets || 0;
    if (metric === 'debts') return -(totals.liabilities || 0);
    return totals.netWorth || 0;
  }, [metric, totals]);

  const activeDelta = useMemo(() => {
    const uniqueDates = Array.from(new Set((balances || []).filter(b => b && b.date).map(b => b.date))).sort(
      (a, b) => new Date(a) - new Date(b)
    );
    
    let targetDates = [];
    if (uniqueDates.length > 12) {
      const monthlyGroups = {};
      uniqueDates.forEach(date => {
        const key = date.substring(0, 7); // YYYY-MM
        if (!monthlyGroups[key]) {
          monthlyGroups[key] = [];
        }
        monthlyGroups[key].push(date);
      });
      const sortedMonths = Object.keys(monthlyGroups).sort();
      sortedMonths.forEach(m => {
        const datesInMonth = monthlyGroups[m].sort();
        targetDates.push(datesInMonth[datesInMonth.length - 1]);
      });
      if (targetDates.length > 36) {
        targetDates = targetDates.slice(-36);
      }
    } else {
      targetDates = uniqueDates.slice(-5);
    }
    
    if (targetDates.length < 2) {
      return { pct: '0%', dir: 'up' };
    }

    const getSnapshotVal = (date) => {
      let assetsSum = 0;
      let liabilitiesSum = 0;
      const dateBalances = (balances || []).filter(b => b && b.date === date);
      const map = new Map();
      dateBalances.forEach(b => {
        if (b && b.institution && b.account) {
          const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
          map.set(key, b);
        }
      });
      Array.from(map.values()).forEach(b => {
        if (!b) return;
        const val = Number(b.balance) || 0;
        if (b.class === 'Asset') {
          assetsSum += val;
        } else if (b.class === 'Liability') {
          liabilitiesSum += Math.abs(val);
        }
      });
      if (metric === 'assets') return assetsSum;
      if (metric === 'debts') return liabilitiesSum;
      return assetsSum - liabilitiesSum;
    };

    const firstVal = getSnapshotVal(targetDates[0]);
    const lastVal = getSnapshotVal(targetDates[targetDates.length - 1]);
    const diff = lastVal - firstVal;
    const base = firstVal === 0 ? 1 : Math.abs(firstVal);
    const pct = ((diff / base) * 100).toFixed(1) + '%';
    const dir = diff >= 0 ? 'up' : 'down';
    return { pct, dir };
  }, [balances, metric]);

  const activeDateLabel = useMemo(() => {
    if (historyData.length === 0) return 'Balance History';
    const lastPoint = historyData[historyData.length - 1];
    return `Current Balance (${lastPoint.rawDate})`;
  }, [historyData]);

  return (
    <div className="bg-[#0B0E14] border border-[#161B26] rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden">
      <div className="flex flex-col space-y-2.5 sm:space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-slate-400 font-semibold text-xs tracking-wider uppercase font-display">Net Worth History</h2>
            <button 
              onClick={() => setShowChart(!showChart)}
              className="p-1 rounded-lg hover:bg-obsidian-800 text-slate-500 hover:text-slate-355 transition-colors cursor-pointer"
              title={showChart ? "Collapse Chart" : "Expand Chart"}
            >
              {showChart ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
          
          {/* Tab Toggles */}
          <div className="flex bg-obsidian-900 p-0.5 rounded-full text-[9px] sm:text-[10px] font-extrabold gap-0.5 border border-slate-800/40">
            <button
              onClick={() => setMetric('assets')}
              className={`px-2.5 py-1 sm:px-3 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                metric === 'assets'
                  ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              Assets <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold hidden sm:inline">7</span>
            </button>
            <button
              onClick={() => setMetric('debts')}
              className={`px-2.5 py-1 sm:px-3 rounded-full flex items-center gap-1 transition-all cursor-pointer ${
                metric === 'debts'
                  ? 'bg-[#1D273B] text-rose-400 font-black border border-slate-800/60'
                  : 'text-slate-500 hover:text-slate-350'
              }`}
            >
              Debts <span className="bg-[#121724] text-[8px] px-1 rounded text-slate-400 font-semibold hidden sm:inline">4</span>
            </button>
            <button
              onClick={() => setMetric('history')}
              className={`px-2.5 py-1 sm:px-3 rounded-full transition-all cursor-pointer ${
                metric === 'history'
                  ? 'bg-[#1D273B] text-emerald-400 font-black border border-slate-800/60'
                  : 'text-slate-500 hover:text-slate-330'
              }`}
            >
              History
            </button>
          </div>
        </div>

        {/* Centered current value */}
        <div className="text-center py-1 sm:py-2 space-y-0.5 sm:space-y-1">
          <span className="text-[9px] sm:text-[10px] font-black tracking-widest text-slate-500 uppercase">{activeDateLabel}</span>
          <div className="flex items-center justify-center space-x-2">
            <span className={`text-2xl sm:text-3xl font-extrabold tracking-tight font-display ${
              metric === 'debts' ? 'text-rose-500' : 'text-[#10B981]'
            }`}>
              {formatCurrency(activeValue)}
            </span>
          </div>
          
          {/* Delta pill */}
          <div className="flex justify-center">
            <span className={`inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeDelta.dir === 'up' 
                ? 'bg-emerald-500/10 text-emerald-400' 
                : 'bg-rose-500/10 text-rose-400'
            }`}>
              {activeDelta.dir === 'up' ? '▲' : '▼'} {activeDelta.pct}
            </span>
          </div>
        </div>

        {/* Sparkline Area Graph */}
        {showChart && (
          <div className="w-full pt-1">
            <LineChart 
              data={historyData} 
              height={chartHeight} 
              lineColor={metric === 'debts' ? '#EF4444' : '#10B981'}
              glowColor={metric === 'debts' ? '#EF4444' : '#10B981'}
              gradientColor={metric === 'debts' ? '#EF4444' : '#10B981'}
              fillOpacity={0.08}
              strokeWidth={2}
              showGrid={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
