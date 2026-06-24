import React, { useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { formatCurrency } from '../utils/formatting';
import { 
  Building2, CreditCard, Landmark, PiggyBank, Wallet, 
  ArrowUpRight, ArrowDownRight, RefreshCw, AlertTriangle, ArrowRight 
} from 'lucide-react';

export default function Accounts({ setCurrentView }) {
  const { 
    balances = [], 
    navigateToTransactions, 
    isLoading,
    updateBalance,
    snapTradeHoldings,
    snapTradeStatus
  } = useAppContext();

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

  const reconciliationData = useMemo(() => {
    if (!snapTradeStatus?.connected || !snapTradeHoldings?.accounts) return [];
    
    return snapTradeHoldings.accounts.map(stAcc => {
      // Find matching Sheets account (case insensitive, partial match)
      const sheetMatch = latestBalances.find(b => 
        b.account_id === stAcc.id || 
        b.account?.toLowerCase().includes(stAcc.name?.toLowerCase()) ||
        stAcc.name?.toLowerCase().includes(b.account?.toLowerCase())
      );
      
      const stVal = stAcc.balances?.current || 0;
      const sheetsVal = sheetMatch ? Number(sheetMatch.balance) || 0 : 0;
      const variance = stVal - sheetsVal;
      const variancePercent = sheetsVal > 0 ? (variance / sheetsVal) * 100 : 0;
      
      return {
        id: stAcc.id,
        name: stAcc.name,
        institution: stAcc.institution_name || 'Brokerage',
        stValue: stVal,
        sheetsValue: sheetsVal,
        sheetsMatch: sheetMatch,
        variance,
        variancePercent
      };
    });
  }, [latestBalances, snapTradeHoldings, snapTradeStatus]);

  const handleReconcile = async (item) => {
    if (!updateBalance) return;
    await updateBalance({
      accountName: item.sheetsMatch?.account || item.name,
      institution: item.sheetsMatch?.institution || item.institution,
      balance: item.stValue,
      accountId: item.id,
      accountClass: 'Asset',
      accountType: 'Investment'
    });
  };

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

const getInstitutionDomain = (institution = '', accountName = '') => {
  const inst = String(institution).toLowerCase();
  const acc = String(accountName).toLowerCase();
  
  if (inst.includes('ally') || acc.includes('ally')) return 'ally.com';
  if (inst.includes('american express') || inst.includes('amex') || acc.includes('american express') || acc.includes('amex')) return 'americanexpress.com';
  if (inst.includes('bank of america') || inst.includes('bofa') || acc.includes('bank of america') || acc.includes('bofa') || acc.includes('adv tiered') || acc.includes('advantage savings')) return 'bankofamerica.com';
  if (inst.includes('capital one') || acc.includes('capital one') || acc.includes('venture')) return 'capitalone.com';
  if (inst.includes('chase') || acc.includes('chase')) return 'chase.com';
  if (inst.includes('citibank') || inst.includes('citi') || acc.includes('citi')) return 'citi.com';
  if (inst.includes('etrade') || inst.includes('e*trade') || acc.includes('etrade') || acc.includes('e*trade')) return 'etrade.com';
  if (inst.includes('fidelity') || acc.includes('fidelity') || acc.includes('roth ira') || acc.includes('traditional ira') || acc.includes('community property') || acc.includes('401(k)')) return 'fidelity.com';
  if (inst.includes('healthequity') || acc.includes('healthequity') || acc.includes('hsa')) return 'healthequity.com';
  if (inst.includes('robinhood') || acc.includes('robinhood')) return 'robinhood.com';
  if (inst.includes('scholarshare') || acc.includes('scholarshare')) return 'scholarshare529.com';
  if (inst.includes('sofi') || acc.includes('sofi')) return 'sofi.com';
  if (inst.includes('wealthfront') || acc.includes('wealthfront')) return 'wealthfront.com';
  if (inst.includes('wells fargo') || inst.includes('wells') || acc.includes('wells fargo') || acc.includes('wells')) return 'wellsfargo.com';
  if (inst.includes('my529') || acc.includes('my529') || acc.includes('trevisan total us stock')) return 'my529.org';
  
  return null;
};

  const getBrandIcon = (accountName = '', type = '', institution = '') => {
    const domain = getInstitutionDomain(institution, accountName);
    if (domain) {
      return (
        <img 
          src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`} 
          alt={domain} 
          className="w-3.5 h-3.5 object-contain"
          onError={(e) => {
            e.target.style.display = 'none';
          }}
        />
      );
    }

    const nameLower = (accountName || '').toLowerCase();
    const typeLower = (type || '').toLowerCase();

    // Fallbacks
    if (nameLower.includes('savings') || typeLower.includes('savings')) {
      return <PiggyBank size={14} className="text-emerald-400" />;
    }
    if (nameLower.includes('credit') || nameLower.includes('card') || typeLower.includes('credit')) {
      return <CreditCard size={14} className="text-rose-400" />;
    }
    if (nameLower.includes('checking') || typeLower.includes('checking')) {
      return <Landmark size={14} className="text-neon-indigo" />;
    }
    if (nameLower.includes('investment') || nameLower.includes('brokerage') || typeLower.includes('investment')) {
      return <Building2 size={14} className="text-violet-400" />;
    }
    return <Wallet size={14} className="text-slate-400" />;
  };

  const getBrandIconContainerClass = (accountName = '', institution = '') => {
    const domain = getInstitutionDomain(institution, accountName);
    if (domain) {
      return 'bg-obsidian-900 border border-obsidian-800 flex items-center justify-center p-0.5 overflow-hidden';
    }

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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="bg-obsidian-900 border border-obsidian-750 p-6">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Assets</span>
          <div className="flex items-center space-x-2 text-neon-emerald mt-1">
            <ArrowUpRight size={18} />
            <span className="text-2xl font-black text-white">{formatCurrency(totalAssets)}</span>
          </div>
        </Card>

        <Card className="bg-obsidian-900 border border-obsidian-750 p-6">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Liabilities</span>
          <div className="flex items-center space-x-2 text-neon-crimson mt-1">
            <ArrowDownRight size={18} />
            <span className="text-2xl font-black text-white">-{formatCurrency(totalLiabilities)}</span>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-obsidian-900 to-neon-indigo/5 border border-obsidian-750 p-6">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Net Worth</span>
          <div className="flex items-center space-x-2 text-neon-indigo mt-1">
            <Landmark size={18} />
            <span className="text-2xl font-black text-white">{formatCurrency(totalAssets - totalLiabilities)}</span>
          </div>
        </Card>
      </div>
      {snapTradeStatus?.connected && reconciliationData.length > 0 && (
        <Card className="bg-obsidian-900 border border-obsidian-750 p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-obsidian-850">
            <div>
              <h3 className="font-bold text-white text-base flex items-center space-x-2">
                <RefreshCw size={16} className="text-neon-indigo" />
                <span>Brokerage Ledger Reconciliation</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">Compare Google Sheets ledger balances with live brokerage evaluations.</p>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-obsidian-800 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="pb-3 pt-1">Account</th>
                  <th className="pb-3 pt-1 text-right">Google Sheets</th>
                  <th className="pb-3 pt-1 text-right">Live SnapTrade</th>
                  <th className="pb-3 pt-1 text-right">Variance</th>
                  <th className="pb-3 pt-1 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-obsidian-850">
                {reconciliationData.map((item) => {
                  const hasDiscrepancy = Math.abs(item.variance) > 0.01;
                  return (
                    <tr key={item.id} className="hover:bg-obsidian-800/10 text-slate-350">
                      <td className="py-3">
                        <span className="font-bold text-white block">{item.name}</span>
                        <span className="text-[10px] text-slate-500 font-semibold">{item.institution}</span>
                      </td>
                      <td className="py-3 text-right font-mono font-medium">{formatCurrency(item.sheetsValue)}</td>
                      <td className="py-3 text-right font-mono font-bold text-white">{formatCurrency(item.stValue)}</td>
                      <td className="py-3 text-right font-mono">
                        {hasDiscrepancy ? (
                          <span className={item.variance > 0 ? 'text-neon-emerald' : 'text-neon-crimson'}>
                            {item.variance > 0 ? '+' : ''}{formatCurrency(item.variance)}
                            <span className="block text-[9px] opacity-80">({item.variancePercent.toFixed(1)}%)</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">Perfect Match</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        {hasDiscrepancy ? (
                          <button
                            onClick={() => handleReconcile(item)}
                            className="px-2.5 py-1 bg-neon-indigo/10 border border-neon-indigo/35 hover:bg-neon-indigo/25 text-neon-indigo text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                          >
                            Sync Ledger
                          </button>
                        ) : (
                          <span className="text-neon-emerald font-semibold text-[10px]">Synced</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Assets List */}
        <Card className="bg-obsidian-900 border border-obsidian-750 p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-obsidian-850">
            <h3 className="font-bold text-white text-base">Asset Accounts ({assets.length})</h3>
            <span className="text-sm font-bold text-emerald-400">{formatCurrency(totalAssets)}</span>
          </div>
          
          <div className="space-y-1.5">
            {assets.map(acc => {
              const status = getAccountSyncStatus(acc.account);
              return (
                <div
                  key={acc.id}
                  onClick={() => handleAccountClick(acc.account)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-800/20 -mx-3 px-3 rounded-2xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                    <div className={`p-2 rounded-xl transition-all duration-300 shrink-0 flex items-center justify-center w-8 h-8 ${getBrandIconContainerClass(acc.account, acc.institution)}`}>
                      {getBrandIcon(acc.account, acc.type, acc.institution)}
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
        <Card className="bg-obsidian-900 border border-obsidian-750 p-6 space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-obsidian-850">
            <h3 className="font-bold text-white text-base">Liability Accounts ({liabilities.length})</h3>
            <span className="text-sm font-bold text-rose-455">-{formatCurrency(totalLiabilities)}</span>
          </div>

          <div className="space-y-1.5">
            {liabilities.map(acc => {
              const status = getAccountSyncStatus(acc.account);
              return (
                <div
                  key={acc.id}
                  onClick={() => handleAccountClick(acc.account)}
                  className="py-3.5 flex items-center justify-between hover:bg-slate-800/20 -mx-3 px-3 rounded-2xl transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3.5 min-w-0 pr-4">
                    <div className={`p-2 rounded-xl transition-all duration-300 shrink-0 flex items-center justify-center w-8 h-8 ${getBrandIconContainerClass(acc.account, acc.institution)}`}>
                      {getBrandIcon(acc.account, acc.type, acc.institution)}
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
