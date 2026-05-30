import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { formatCurrency } from '../utils/formatting';
import { 
  Building2, CreditCard, Landmark, PiggyBank, Wallet, 
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, ArrowRight 
} from 'lucide-react';

export default function Accounts({ setCurrentView }) {
  const { balances, navigateToTransactions, isLoading } = useAppContext();

  // Deduplicate and get latest balance snapshots per account
  const latestBalances = useMemo(() => {
    const latestMap = new Map();
    const sorted = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMap.set(key, b);
    });
    return Array.from(latestMap.values());
  }, [balances]);

  // Group accounts by Assets vs Liabilities
  const { assets, liabilities, totalAssets, totalLiabilities } = useMemo(() => {
    const assetsList = [];
    const liabilitiesList = [];
    let assetsSum = 0;
    let liabilitiesSum = 0;

    latestBalances.forEach(b => {
      const val = Number(b.balance) || 0;
      if (b.class === 'Asset') {
        assetsList.push(b);
        assetsSum += val;
      } else if (b.class === 'Liability') {
        liabilitiesList.push(b);
        liabilitiesSum += Math.abs(val);
      }
    });

    return {
      assets: assetsList.sort((a, b) => b.balance - a.balance),
      liabilities: liabilitiesList.sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance)),
      totalAssets: assetsSum,
      totalLiabilities: liabilitiesSum
    };
  }, [latestBalances]);

  const getBrandIcon = (accountName = '', type = '') => {
    const nameLower = (accountName || '').toLowerCase();
    const typeLower = (type || '').toLowerCase();

    // Chase
    if (nameLower.includes('chase')) {
      return (
        <svg viewBox="0 0 100 100" className="w-4 h-4 fill-white">
          <path d="M 50 15 L 78 15 L 85 22 L 85 50 L 50 50 Z" opacity="0.8"/>
          <path d="M 85 50 L 85 78 L 78 85 L 50 85 L 50 50 Z" opacity="0.9"/>
          <path d="M 50 85 L 25 85 L 15 78 L 15 50 L 50 50 Z" opacity="1.0"/>
          <path d="M 15 50 L 15 22 L 22 15 L 50 15 L 50 50 Z" opacity="0.7"/>
          <rect x="35" y="35" width="30" height="30" fill="#1172be" />
        </svg>
      );
    }

    // Robinhood
    if (nameLower.includes('robinhood')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-none stroke-[#00c805] stroke-[2]">
          <path d="M2 22C2 22 7.5 19.5 12 15C16.5 10.5 18.5 4 18.5 4C18.5 4 12 6 7.5 10.5C3 15 2.5 21.5 2.5 21.5" />
          <path d="M7.5 10.5C7.5 10.5 9.5 15.5 14.5 14.5" />
        </svg>
      );
    }

    // SoFi
    if (nameLower.includes('sofi')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
          <circle cx="6" cy="6" r="2.2" />
          <circle cx="12" cy="6" r="2.2" />
          <circle cx="18" cy="6" r="2.2" />
          <circle cx="6" cy="12" r="2.2" />
          <circle cx="12" cy="12" r="2.2" />
          <circle cx="18" cy="12" r="2.2" />
          <circle cx="6" cy="18" r="2.2" />
          <circle cx="12" cy="18" r="2.2" />
          <circle cx="18" cy="18" r="2.2" />
        </svg>
      );
    }

    // Wells Fargo
    if (nameLower.includes('wells fargo') || nameLower.includes('wf') || nameLower.includes('wells')) {
      return <span className="text-[#f6d000] font-black text-[9px] tracking-tighter">WF</span>;
    }

    // Bank of America
    if (nameLower.includes('bofa') || nameLower.includes('bank of america') || nameLower.includes('america')) {
      return <span className="text-white font-extrabold text-[8px] tracking-tighter">BofA</span>;
    }

    // Vanguard
    if (nameLower.includes('vanguard')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#dcb35c]">
          <path d="M12 2L2 22h20L12 2zm0 4l6.5 13h-13L12 6z" />
        </svg>
      );
    }

    // Fidelity
    if (nameLower.includes('fidelity')) {
      return (
        <svg viewBox="0 0 24 24" className="w-4 h-4 fill-[#ffc72c] stroke-[#ffc72c] stroke-[1] fill-none">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 6l3 6h-6z" fill="#ffc72c" />
          <path d="M12 18l-3-6h6z" fill="#ffc72c" />
        </svg>
      );
    }

    // E*TRADE
    if (nameLower.includes('etrade') || nameLower.includes('e*trade')) {
      return <span className="text-[#8cc63f] font-black text-[9px] tracking-tight">E*T</span>;
    }

    // Apple Card / Apple
    if (nameLower.includes('apple')) {
      return (
        <svg viewBox="0 0 170 170" className="w-3.5 h-3.5 fill-white">
          <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.34.13-9.13-1.92-14.38-6.15-2.82-2.38-6.53-6.82-11.13-13.32-6.15-8.75-11.45-18.42-15.88-29.02-4.43-10.6-6.64-20.73-6.64-30.37 0-13.88 3.53-25.05 10.59-33.51 7.07-8.47 16.21-12.78 27.42-12.91 5.07 0 10.2 1.34 15.39 4.02 5.2 2.68 8.7 4.02 10.5 4.02 1.68 0 5.17-1.34 10.5-4.02 5.33-2.68 10.15-3.9 14.46-3.69 11.29.54 20.08 4.65 26.38 12.35-8.89 5.41-13.27 12.86-13.15 22.37.13 7.6 2.87 13.97 8.22 19.12 5.35 5.15 11.82 8.01 19.4 8.57-2.33 6.72-5.7 13.39-10.11 20.01zm-32.96-107c0-6.15 2.18-11.75 6.53-16.78 4.35-5.04 9.77-8.14 16.27-9.33.11 6.81-2.07 12.73-6.53 17.75-4.47 5.04-9.97 8.27-16.27 8.36z" />
        </svg>
      );
    }

    // American Express / Amex
    if (nameLower.includes('amex') || nameLower.includes('american express')) {
      return <span className="text-white font-extrabold text-[8px] tracking-tighter">AMEX</span>;
    }

    // Marcus
    if (nameLower.includes('marcus')) {
      return <span className="text-[#a28056] font-black text-xs">M</span>;
    }

    // Wise
    if (nameLower.includes('wise')) {
      return <span className="text-white font-black text-xs">W</span>;
    }

    // Revolut
    if (nameLower.includes('revolut')) {
      return <span className="text-white font-bold text-xs">R</span>;
    }

    // Venmo
    if (nameLower.includes('venmo')) {
      return <span className="text-white font-black text-xs">V</span>;
    }

    // Fallbacks
    if (nameLower.includes('savings') || typeLower.includes('savings')) {
      return <PiggyBank size={18} className="text-emerald-400" />;
    }
    if (nameLower.includes('credit') || nameLower.includes('card') || typeLower.includes('credit')) {
      return <CreditCard size={18} className="text-rose-400" />;
    }
    if (nameLower.includes('checking') || typeLower.includes('checking')) {
      return <Landmark size={18} className="text-neon-indigo" />;
    }
    if (nameLower.includes('investment') || nameLower.includes('brokerage') || typeLower.includes('investment')) {
      return <Building2 size={18} className="text-violet-400" />;
    }
    return <Wallet size={18} className="text-slate-400" />;
  };

  const getBrandIconContainerClass = (accountName = '') => {
    const nameLower = (accountName || '').toLowerCase();
    if (nameLower.includes('chase')) return 'bg-[#1172be] border-none';
    if (nameLower.includes('robinhood')) return 'bg-[#00c805]/10 border border-[#00c805]/30';
    if (nameLower.includes('sofi')) return 'bg-[#0052ff] border-none';
    if (nameLower.includes('wells fargo') || nameLower.includes('wf') || nameLower.includes('wells')) return 'bg-[#b31b1b] border-none';
    if (nameLower.includes('bofa') || nameLower.includes('bank of america') || nameLower.includes('america')) return 'bg-[#002664] border-none';
    if (nameLower.includes('vanguard')) return 'bg-[#73191b] border-none';
    if (nameLower.includes('fidelity')) return 'bg-[#007a33] border-none';
    if (nameLower.includes('etrade') || nameLower.includes('e*trade')) return 'bg-[#5c2d91] border-none';
    if (nameLower.includes('apple')) return 'bg-gradient-to-tr from-slate-900 to-slate-700 border-none';
    if (nameLower.includes('amex') || nameLower.includes('american express')) return 'bg-[#006fcf] border-none';
    if (nameLower.includes('marcus')) return 'bg-[#0c2340] border border-[#a28056]/30';
    if (nameLower.includes('wise')) return 'bg-[#00B9FF] border-none';
    if (nameLower.includes('revolut')) return 'bg-black border-none';
    if (nameLower.includes('venmo')) return 'bg-[#008CFF] border-none';
    return 'bg-obsidian-900 border border-obsidian-800';
  };

  const getAccountSyncStatus = (accName) => {
    const name = accName.toLowerCase();
    if (name.includes('emirates') || name.includes('revolut') || name.includes('apple') || name.includes('amex') || name.includes('adcb')) {
      return { label: 'Sync Delayed', color: 'text-rose-500 bg-rose-500/10 border border-rose-500/20' };
    }
    if (name.includes('venmo')) {
      return { label: 'Action Required', color: 'text-amber-500 bg-amber-500/10 border border-amber-500/20' };
    }
    return { label: 'Synced', color: 'text-emerald-400 bg-emerald-500/10 border border-emerald-500/20' };
  };

  const handleAccountClick = (accountName) => {
    navigateToTransactions({ account: accountName });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-12 bg-obsidian-800 rounded-2xl w-1/4"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
          <div className="h-96 bg-obsidian-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-white font-display">Accounts</h1>
        <p className="text-sm text-slate-400">View and click into individual institution accounts to audit underlying transactions.</p>
      </div>

      {/* Net Worth Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Assets</span>
          <div className="flex items-center space-x-2 text-neon-emerald mt-1">
            <ArrowUpRight size={18} />
            <span className="text-2xl font-black text-white">{formatCurrency(totalAssets)}</span>
          </div>
        </Card>

        <Card className="bg-[#0B0E14] border border-[#161B26] p-6">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Liabilities</span>
          <div className="flex items-center space-x-2 text-neon-crimson mt-1">
            <ArrowDownRight size={18} />
            <span className="text-2xl font-black text-white">-{formatCurrency(totalLiabilities)}</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-[#0B0E14] to-neon-indigo/5 border border-[#161B26] p-6">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Net Worth</span>
          <div className="flex items-center space-x-2 text-neon-indigo mt-1">
            <Landmark size={18} />
            <span className="text-2xl font-black text-white">{formatCurrency(totalAssets - totalLiabilities)}</span>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets List */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-obsidian-850">
            <h3 className="font-bold text-white text-base">Asset Accounts ({assets.length})</h3>
            <span className="text-sm font-bold text-emerald-400">{formatCurrency(totalAssets)}</span>
          </div>
          
          <div className="divide-y divide-slate-850/45 space-y-1">
            {assets.map(acc => {
              const status = getAccountSyncStatus(acc.account);
              return (
                <div
                  key={acc.id}
                  onClick={() => handleAccountClick(acc.account)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-800/20 -mx-3 px-3 rounded-2xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                    <div className={`p-2 rounded-xl transition-all duration-300 shrink-0 flex items-center justify-center w-8 h-8 ${getBrandIconContainerClass(acc.account)}`}>
                      {getBrandIcon(acc.account, acc.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 group-hover:text-neon-indigo transition-colors truncate text-sm">{acc.account}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate uppercase tracking-wider font-semibold">{acc.institution} • {acc.type || 'Asset'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3.5 shrink-0 text-right">
                    <div>
                      <p className="font-extrabold text-white text-sm">{formatCurrency(acc.balance)}</p>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 inline-block ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-neon-indigo group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Liabilities List */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-obsidian-850">
            <h3 className="font-bold text-white text-base">Liability Accounts ({liabilities.length})</h3>
            <span className="text-sm font-bold text-rose-455">-{formatCurrency(totalLiabilities)}</span>
          </div>

          <div className="divide-y divide-slate-850/45 space-y-1">
            {liabilities.map(acc => {
              const status = getAccountSyncStatus(acc.account);
              return (
                <div
                  key={acc.id}
                  onClick={() => handleAccountClick(acc.account)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-800/20 -mx-3 px-3 rounded-2xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                    <div className={`p-2 rounded-xl transition-all duration-300 shrink-0 flex items-center justify-center w-8 h-8 ${getBrandIconContainerClass(acc.account)}`}>
                      {getBrandIcon(acc.account, acc.type)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-100 group-hover:text-neon-indigo transition-colors truncate text-sm">{acc.account}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5 truncate uppercase tracking-wider font-semibold">{acc.institution} • {acc.type || 'Liability'}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3.5 shrink-0 text-right">
                    <div>
                      <p className="font-extrabold text-white text-sm">-{formatCurrency(Math.abs(acc.balance))}</p>
                      <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full mt-0.5 inline-block ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <ArrowRight size={14} className="text-slate-600 group-hover:text-neon-indigo group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
