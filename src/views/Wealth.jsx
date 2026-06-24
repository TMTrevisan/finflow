import React, { useState, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import Accounts from './Accounts';
import DonutChart from '../components/ui/DonutChart';
import { formatCurrency } from '../utils/formatting';
import { safeStorage } from '../utils/storage';
import { 
  TrendingUp, TrendingDown, Download, Search, Briefcase, 
  PieChart as ChartIcon, DollarSign, ArrowUpDown, Landmark
} from 'lucide-react';

const COLORS = [
  '#6366F1', // Indigo
  '#10B981', // Emerald
  '#F43F5E', // Rose
  '#F59E0B', // Amber
  '#8B5CF6', // Violet
  '#06B6D4', // Cyan
  '#EC4899', // Pink
  '#14B8A6'  // Teal
];

export default function Wealth({ setCurrentView }) {
  const { snapTradeHoldings, snapTradeStatus } = useAppContext();
  const [activeTab, setActiveTab] = useState('balances');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState(() => safeStorage.getItem('finflow_holdings_sort_field') || 'value');
  const [sortDirection, setSortDirection] = useState(() => safeStorage.getItem('finflow_holdings_sort_direction') || 'desc');

  const positions = useMemo(() => {
    return snapTradeHoldings?.positions || [];
  }, [snapTradeHoldings]);

  const accounts = useMemo(() => {
    return snapTradeHoldings?.accounts || [];
  }, [snapTradeHoldings]);

  const accMap = useMemo(() => {
    return new Map(accounts.map(a => [a.id, a]));
  }, [accounts]);

  // Aggregate stats
  const stats = useMemo(() => {
    let totalValue = 0;
    let totalCost = 0;
    let totalPnl = 0;
    let totalDayPnl = 0;

    positions.forEach(pos => {
      totalValue += pos.value || 0;
      totalCost += pos.total_cost || 0;
      totalPnl += pos.open_pnl || 0;
      totalDayPnl += pos.day_pnl || 0;
    });

    const pnlPercent = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;
    const dayPnlPercent = totalValue > 0 ? (totalDayPnl / totalValue) * 100 : 0;

    return { totalValue, totalCost, totalPnl, pnlPercent, totalDayPnl, dayPnlPercent };
  }, [positions]);

  // Filter & Sort positions
  const sortedPositions = useMemo(() => {
    let list = [...positions];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(pos => {
        const acc = accMap.get(pos.account_id) || {};
        return (
          pos.symbol?.symbol?.toLowerCase().includes(q) ||
          pos.symbol?.name?.toLowerCase().includes(q) ||
          acc.name?.toLowerCase().includes(q)
        );
      });
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (sortField === 'symbol') {
        valA = a.symbol?.symbol || '';
        valB = b.symbol?.symbol || '';
      } else if (sortField === 'name') {
        valA = a.symbol?.name || '';
        valB = b.symbol?.name || '';
      } else if (sortField === 'account') {
        const accA = accMap.get(a.account_id) || {};
        const accB = accMap.get(b.account_id) || {};
        valA = accA.name || '';
        valB = accB.name || '';
      }

      if (typeof valA === 'string') {
        return sortDirection === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return sortDirection === 'asc' 
          ? (valA || 0) - (valB || 0) 
          : (valB || 0) - (valA || 0);
      }
    });

    return list;
  }, [positions, searchQuery, sortField, sortDirection, accMap]);

  const handleSort = (field) => {
    let nextDir = 'desc';
    if (sortField === field) {
      nextDir = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      nextDir = 'desc';
    }
    setSortField(field);
    setSortDirection(nextDir);
    safeStorage.setItem('finflow_holdings_sort_field', field);
    safeStorage.setItem('finflow_holdings_sort_direction', nextDir);
  };

  const handleExportCSV = () => {
    if (sortedPositions.length === 0) return;
    const headers = ['Symbol', 'Description', 'Account', 'Shares', 'Price', 'Value', 'Cost Basis', 'Total P&L ($)', 'Total P&L (%)', 'Day P&L ($)', 'Day P&L (%)'];
    const rows = sortedPositions.map(pos => {
      const acc = accMap.get(pos.account_id) || {};
      return [
        pos.symbol?.symbol,
        `"${(pos.symbol?.name || '').replace(/"/g, '""')}"`,
        `"${acc.name || 'Brokerage'}"`,
        pos.units,
        pos.price,
        pos.value,
        pos.average_buy_price,
        pos.open_pnl,
        pos.total_pnl_percent,
        pos.day_pnl,
        pos.day_pnl_percent
      ];
    });
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `finflow_holdings_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Allocations aggregations
  const allocations = useMemo(() => {
    const assetClasses = {};
    const sectors = {};
    const geographies = {};

    positions.forEach(pos => {
      const val = pos.value || 0;
      const ac = pos.assetClass || 'US Equities';
      const sec = pos.sector || 'Technology';
      const geo = pos.geography || 'United States';

      assetClasses[ac] = (assetClasses[ac] || 0) + val;
      sectors[sec] = (sectors[sec] || 0) + val;
      geographies[geo] = (geographies[geo] || 0) + val;
    });

    const formatData = (obj) => {
      return Object.entries(obj)
        .map(([name, value], i) => ({
          name,
          value,
          color: COLORS[i % COLORS.length]
        }))
        .sort((a, b) => b.value - a.value);
    };

    return {
      assetClass: formatData(assetClasses),
      sector: formatData(sectors),
      geography: formatData(geographies)
    };
  }, [positions]);

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-obsidian-800 space-x-6 pb-2">
        <button
          onClick={() => setActiveTab('balances')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'balances' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Balances
        </button>
        <button
          onClick={() => setActiveTab('holdings')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'holdings' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Holdings
        </button>
        <button
          onClick={() => setActiveTab('allocations')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'allocations' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Allocations
        </button>
      </div>

      {activeTab === 'balances' && (
        <Accounts setCurrentView={setCurrentView} />
      )}

      {activeTab === 'holdings' && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5">
              <CardContent className="p-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Portfolio Value</span>
                <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(stats.totalValue)}</p>
              </CardContent>
            </Card>
            <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5">
              <CardContent className="p-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Return</span>
                <div className="flex items-center space-x-1 mt-1">
                  <p className={`text-xl font-extrabold ${stats.totalPnl >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
                    {formatCurrency(stats.totalPnl)}
                  </p>
                  <span className={`text-xs font-bold ${stats.totalPnl >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
                    ({stats.pnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5">
              <CardContent className="p-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Day P&L</span>
                <div className="flex items-center space-x-1 mt-1">
                  <p className={`text-xl font-extrabold ${stats.totalDayPnl >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
                    {formatCurrency(stats.totalDayPnl)}
                  </p>
                  <span className={`text-xs font-bold ${stats.totalDayPnl >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
                    ({stats.dayPnlPercent.toFixed(2)}%)
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5">
              <CardContent className="p-0">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Cost Basis</span>
                <p className="text-xl font-extrabold text-white mt-1">{formatCurrency(stats.totalCost)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input
                type="text"
                placeholder="Search symbol, security or account..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-obsidian-800/40 border border-obsidian-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white focus:outline-none focus:border-neon-indigo/55"
              />
            </div>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-750 text-slate-200 text-xs font-bold rounded-xl transition-colors flex items-center space-x-2 cursor-pointer w-full md:w-auto justify-center"
            >
              <Download size={14} />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Holdings Table */}
          <Card className="bg-obsidian-800/20 border-obsidian-800/80 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-obsidian-800 bg-obsidian-900/30 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="p-4 cursor-pointer hover:text-slate-300" onClick={() => handleSort('symbol')}>
                      <div className="flex items-center space-x-1"><span>Symbol</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 cursor-pointer hover:text-slate-300" onClick={() => handleSort('name')}>
                      <div className="flex items-center space-x-1"><span>Security</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 cursor-pointer hover:text-slate-300" onClick={() => handleSort('account')}>
                      <div className="flex items-center space-x-1"><span>Account</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('units')}>
                      <div className="flex items-center justify-end space-x-1"><span>Qty</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('price')}>
                      <div className="flex items-center justify-end space-x-1"><span>Price</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('value')}>
                      <div className="flex items-center justify-end space-x-1"><span>Market Value</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('average_buy_price')}>
                      <div className="flex items-center justify-end space-x-1"><span>Avg Cost</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('open_pnl')}>
                      <div className="flex items-center justify-end space-x-1"><span>Total P&L</span><ArrowUpDown size={10} /></div>
                    </th>
                    <th className="p-4 text-right cursor-pointer hover:text-slate-300" onClick={() => handleSort('day_pnl')}>
                      <div className="flex items-center justify-end space-x-1"><span>Day P&L</span><ArrowUpDown size={10} /></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-850 text-xs">
                  {sortedPositions.length === 0 ? (
                    <tr>
                      <td colSpan="9" className="p-8 text-center text-slate-500">
                        No holdings found. Ensure you have linked your brokerages in Settings.
                      </td>
                    </tr>
                  ) : (
                    sortedPositions.map((pos, idx) => {
                      const acc = accMap.get(pos.account_id) || {};
                      const isTotalPnlPos = (pos.open_pnl || 0) >= 0;
                      const isDayPnlPos = (pos.day_pnl || 0) >= 0;

                      return (
                        <tr key={`${pos.account_id}_${pos.symbol?.symbol}_${idx}`} className="hover:bg-obsidian-800/10 text-slate-300">
                          <td className="p-4 font-mono font-bold text-white">{pos.symbol?.symbol}</td>
                          <td className="p-4 font-medium truncate max-w-[200px]" title={pos.symbol?.name}>{pos.symbol?.name}</td>
                          <td className="p-4 text-slate-400 font-medium">{acc.name || 'Brokerage'}</td>
                          <td className="p-4 text-right font-mono font-medium">{pos.units?.toLocaleString()}</td>
                          <td className="p-4 text-right font-mono font-medium">{formatCurrency(pos.price)}</td>
                          <td className="p-4 text-right font-mono font-bold text-white">{formatCurrency(pos.value)}</td>
                          <td className="p-4 text-right font-mono text-slate-450">{formatCurrency(pos.average_buy_price)}</td>
                          <td className="p-4 text-right font-mono">
                            <span className={isTotalPnlPos ? 'text-neon-emerald' : 'text-neon-crimson'}>
                              {pos.open_pnl >= 0 ? '+' : ''}{formatCurrency(pos.open_pnl)}
                            </span>
                            <span className={`block text-[10px] font-bold ${isTotalPnlPos ? 'text-neon-emerald/80' : 'text-neon-crimson/80'}`}>
                              {pos.total_pnl_percent?.toFixed(2)}%
                            </span>
                          </td>
                          <td className="p-4 text-right font-mono">
                            <span className={isDayPnlPos ? 'text-neon-emerald' : 'text-neon-crimson'}>
                              {pos.day_pnl >= 0 ? '+' : ''}{formatCurrency(pos.day_pnl)}
                            </span>
                            <span className={`block text-[10px] font-bold ${isDayPnlPos ? 'text-neon-emerald/80' : 'text-neon-crimson/80'}`}>
                              {pos.day_pnl_percent?.toFixed(2)}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'allocations' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-base mb-4 flex items-center space-x-2">
                <Briefcase size={16} className="text-neon-indigo" />
                <span>Asset Class Allocation</span>
              </h3>
              {allocations.assetClass.length === 0 ? (
                <p className="text-slate-500 text-xs py-8 text-center">No asset class data available.</p>
              ) : (
                <DonutChart 
                  data={allocations.assetClass} 
                  centerLabel="Portfolio" 
                  centerSublabel="By Asset Class" 
                  size={200}
                />
              )}
            </div>
          </Card>
          <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-base mb-4 flex items-center space-x-2">
                <ChartIcon size={16} className="text-neon-indigo" />
                <span>Sector Allocation</span>
              </h3>
              {allocations.sector.length === 0 ? (
                <p className="text-slate-500 text-xs py-8 text-center">No sector data available.</p>
              ) : (
                <DonutChart 
                  data={allocations.sector} 
                  centerLabel="Sector" 
                  centerSublabel="Distribution" 
                  size={200}
                />
              )}
            </div>
          </Card>
          <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
            <div>
              <h3 className="font-bold text-white text-base mb-4 flex items-center space-x-2">
                <Landmark size={16} className="text-neon-indigo" />
                <span>Geography Allocation</span>
              </h3>
              {allocations.geography.length === 0 ? (
                <p className="text-slate-500 text-xs py-8 text-center">No geography data available.</p>
              ) : (
                <DonutChart 
                  data={allocations.geography} 
                  centerLabel="Regions" 
                  centerSublabel="Exposure" 
                  size={200}
                />
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
