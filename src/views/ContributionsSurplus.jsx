import React, { useState, useMemo, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { formatCurrency } from '../utils/formatting';
import { motion } from 'framer-motion';
import SurplusGoalTracker from '../components/ui/SurplusGoalTracker';
import {
  TrendingUp,
  ArrowRight,
  Wallet,
  Sliders,
  Calculator,
  Percent,
  Coins,
  ShieldAlert,
  HelpCircle,
  PiggyBank,
  ArrowUpRight,
  Info,
  AlertTriangle,
  Zap,
  Sparkles,
  CheckCircle
} from 'lucide-react';

export default function ContributionsSurplus() {
  const { 
    transactions = [], 
    balances = [], 
    surplusMetrics = {},
    resolvedPartnerAName = "Wife",
    resolvedPartnerBName = "Husband",
    resolvedPartnerAEmployer = "Employer A",
    resolvedPartnerBEmployer = "Employer B"
  } = useAppContext() || {};

  // --- STATE FOR INTERACTIVE CALCULATOR (With default formulas/specifications) ---
  const [toddGrossIncome, setToddGrossIncome] = useState(9500); // monthly gross or net default
  const [kaitlynGrossIncome, setKaitlynGrossIncome] = useState(7000);
  
  // Splits and savings settings
  const [toddJointTransferAmt, setToddJointTransferAmt] = useState(940); // Todd deposits $940 per paycheck to joint
  const [toddPaychecksPerMonth, setToddPaychecksPerMonth] = useState(2); // Twice a month
  const [kaitlynWFTransferPct, setKaitlynWFTransferPct] = useState(100); // Kaitlyn goes entirely to WF then to Joint
  
  // Forced Savings
  const [both401kMax, setBoth401kMax] = useState(46000 / 12); // standard combined 401k max (approx $23k/yr each)
  const [toddHsaYr, setToddHsaYr] = useState(8000); // Todd HSA max $8k/yr
  const [toddDcaYr, setToddDcaYr] = useState(5000); // Todd DCA $5k/yr
  
  // Spending Settings
  const [mortgagePayment, setMortgagePayment] = useState(2259.97); // Todd pays mortgage
  const [jointSpendingSettings, setJointSpendingSettings] = useState(3800); // Groceries, Dining, Travel, Costco, Amazon, Misc
  const [personalSpendingSettings, setPersonalSpendingSettings] = useState(1500);

  // DCA Calculator State
  const [dcaLumpSum, setDcaLumpSum] = useState(10000);
  const [dcaWeeks, setDcaWeeks] = useState(8);

  // --- DATA EXTRACTION FROM REAL TRANSACTIONS ---
  // Try to find Todd / Kaitlyn paychecks dynamically
  const dynamicAverages = useMemo(() => {
    let toddTotal = 0;
    let toddCount = 0;
    let kaitlynTotal = 0;
    let kaitlynCount = 0;
    
    const partnerALower = resolvedPartnerAName.toLowerCase();
    const partnerBLower = resolvedPartnerBName.toLowerCase();
    const employerALower = resolvedPartnerAEmployer.toLowerCase();
    const employerBLower = resolvedPartnerBEmployer.toLowerCase();

    // Scan transactions for Havas, BD, Becton, Kaitlyn, Todd, and dynamic names
    transactions.forEach(t => {
      if (t.type !== 'Income') return;
      const desc = String(t.description || '').toLowerCase();
      const amount = Number(t.amount) || 0;
      
      if (
        desc.includes(partnerALower) || 
        desc.includes(employerALower) || 
        desc.includes('havas') || 
        desc.includes('kaitlyn') || 
        desc.includes('wf') || 
        desc.includes('wells')
      ) {
        kaitlynTotal += amount;
        kaitlynCount++;
      } else if (
        desc.includes(partnerBLower) || 
        desc.includes(employerBLower) || 
        desc.includes('bd') || 
        desc.includes('becton') || 
        desc.includes('todd') || 
        desc.includes('bofa')
      ) {
        toddTotal += amount;
        toddCount++;
      }
    });

    // Fallbacks if no matching transactions found
    const defaultToddIncome = toddCount > 0 ? (toddTotal / toddCount) : 9200;
    const defaultKaitlynIncome = kaitlynCount > 0 ? (kaitlynTotal / kaitlynCount) : 6800;

    // Calculate 6-month averages based on all Income transactions or defaults
    return {
      toddIncome: defaultToddIncome,
      kaitlynIncome: defaultKaitlynIncome,
      toddTotal: toddTotal > 0 ? toddTotal : defaultToddIncome * 6,
      kaitlynTotal: kaitlynTotal > 0 ? kaitlynTotal : defaultKaitlynIncome * 6,
    };
  }, [transactions]);

  // Sync slider defaults with the dynamically calculated averages from the database
  useEffect(() => {
    if (dynamicAverages.toddIncome) {
      setToddGrossIncome(Math.round(dynamicAverages.toddIncome));
    }
    if (dynamicAverages.kaitlynIncome) {
      setKaitlynGrossIncome(Math.round(dynamicAverages.kaitlynIncome));
    }
  }, [dynamicAverages.toddIncome, dynamicAverages.kaitlynIncome]);

  // Balance extraction for SoFi/Chase (Joint) and BoFA/Vanguard (Personal) using latest unique balances
  const accountBalances = useMemo(() => {
    let jointTotal = 0;
    let personalTotal = 0;
    let combinedCashTotal = 0;
    let brokerageTotal = 0;
    
    // Deduplicate and get latest balance snapshots per unique account
    const latestMap = new Map();
    const sorted = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMap.set(key, b);
    });
    const latestBalancesList = Array.from(latestMap.values());

    latestBalancesList.forEach(b => {
      const name = String(b.account || '').toLowerCase();
      const inst = String(b.institution || '').toLowerCase();
      const type = String(b.type || '').toLowerCase();
      const bal = Number(b.balance) || 0;
      
      const isJoint = name.includes('joint') || name.includes('sofi') || name.includes('chase checking') || name.includes('chase total checking');
      const isPersonal = name.includes('personal') || name.includes('bofa') || name.includes('bank of america') || name.includes('marcus') || name.includes('vanguard');
      
      if (isJoint) {
        jointTotal += bal;
      } else if (isPersonal) {
        personalTotal += bal;
      }

      const isInvestment = type.includes('investment') || type.includes('brokerage') || type.includes('retirement') || type.includes('401k') || type.includes('ira') || type.includes('529') || name.includes('vanguard') || name.includes('robinhood') || name.includes('etrade') || name.includes('fidelity');
      const isLiability = b.class === 'Liability';

      if (isInvestment) {
        brokerageTotal += bal;
      } else if (!isLiability && (type.includes('checking') || type.includes('savings') || type.includes('cash') || name.includes('checking') || name.includes('savings') || name.includes('sofi') || name.includes('chase') || name.includes('bofa') || name.includes('wells fargo') || name.includes('marcus') || name.includes('ally'))) {
        combinedCashTotal += bal;
      }
    });

    // Fallbacks if no balances parsed
    return {
      joint: jointTotal !== 0 ? jointTotal : 15850,
      personal: personalTotal !== 0 ? personalTotal : 36409,
      combinedCash: combinedCashTotal !== 0 ? combinedCashTotal : 31500,
      brokerage: brokerageTotal !== 0 ? brokerageTotal : 23559,
    };
  }, [balances]);

  // --- MATHEMATICAL FORMULAS ---
  // Net Inflows
  const toddNetIncome = toddGrossIncome;
  const kaitlynNetIncome = kaitlynGrossIncome;
  const totalNetIncome = toddNetIncome + kaitlynNetIncome;

  // Inflow Routing
  const kaitlynToWF = (kaitlynNetIncome * kaitlynWFTransferPct) / 100;
  const kaitlynToJoint = kaitlynToWF; // Havas -> WF -> Joint SoFi/Chase
  
  const toddToJoint = toddJointTransferAmt * toddPaychecksPerMonth;
  const toddToPersonal = toddNetIncome - toddToJoint;

  const totalJointInflow = kaitlynToJoint + toddToJoint;
  const totalPersonalInflow = toddToPersonal; // TODD ONLY

  // Spending Allocation
  const jointSpending = jointSpendingSettings;
  const personalSpending = personalSpendingSettings;
  const totalSpending = jointSpending + personalSpending + mortgagePayment;

  // Forced Savings (401k + HSA + DCA)
  const monthlyHsa = toddHsaYr / 12;
  const monthlyDca = toddDcaYr / 12;
  const totalForcedSavings = both401kMax + monthlyHsa + monthlyDca;

  // Surplus Calculation - pre-tax 401(k) is already deducted from net take-home income
  const surplus = totalNetIncome - totalSpending - monthlyHsa - monthlyDca;

  // Investment Recommendations
  const investMin = Math.max(0, surplus * 0.60);
  const investMax = Math.max(0, surplus * 0.80);
  const excessCash = Math.max(0, surplus - investMin);

  return (
    <div className="space-y-6 pb-12">
      {/* Premium Header */}
      <div className="bg-gradient-to-br from-[#0e1629] to-[#080d1a] border border-obsidian-800 p-6 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="space-y-1.5">
            <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Coins className="text-neon-indigo animate-pulse" size={22} />
              <span>Contributions & Surplus Analyzer</span>
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl leading-relaxed">
              Visualize partner income routing ({resolvedPartnerAName} & {resolvedPartnerBName}), track Joint vs. Personal account dynamics, analyze multi-category spending, and compute surplus for smart taxable investment planning.
            </p>
          </div>
          <div className="bg-obsidian-900/60 border border-obsidian-850 px-4 py-2.5 rounded-2xl shrink-0">
            <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Net Household Income</span>
            <span className="text-xl font-black text-neon-emerald">{formatCurrency(totalNetIncome)}/mo</span>
          </div>
        </div>
      </div>

      {/* Cash Sweep Alert Banner */}
      {accountBalances.combinedCash > 25000 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/35 p-5 rounded-3xl flex items-start gap-4 shadow-xl"
        >
          <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl shrink-0">
            <AlertTriangle size={24} />
          </div>
          <div className="space-y-1.5 min-w-0 flex-1">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h4 className="text-sm font-black text-amber-200 uppercase tracking-wider">
                Cash Sweep Alert: Idle Cash Target Exceeded
              </h4>
              <span className="text-[10px] font-black text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-full uppercase tracking-widest">
                Action Recommended
              </span>
            </div>
            <p className="text-xs text-amber-300/90 leading-relaxed">
              Your combined cash in checking/savings accounts is <strong className="text-white">{formatCurrency(accountBalances.combinedCash)}</strong>, which is <strong className="text-white">{formatCurrency(accountBalances.combinedCash - 25000)}</strong> above your recommended <strong className="text-white">$25,000</strong> safety threshold. Sweep this excess cash to avoid inflation drag!
            </p>
            <div className="flex items-center gap-4 text-[11px] text-amber-200/80 font-semibold pt-1">
              <span>💡 Target: Sweep {formatCurrency(accountBalances.combinedCash - 25000)} to brokerage</span>
              <span className="text-amber-500">•</span>
              <span>🏦 Recommended Source: SoFi Savings / Chase Joint</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* Side by Side Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Partner A Income Card */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/40 pb-4 mb-4">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Partner A</span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mt-0.5">{resolvedPartnerAName} ({resolvedPartnerAEmployer})</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-obsidian-800 border border-slate-700/30 px-2.5 py-0.5 rounded-full">
              {resolvedPartnerAEmployer} W2 Routing
            </span>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0c0f16] border border-[#161B26] p-3 rounded-2xl">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Dynamic Avg (6mo)</p>
                <p className="text-base font-extrabold text-slate-200 mt-1">{formatCurrency(dynamicAverages.kaitlynIncome)}/mo</p>
              </div>
              <div className="bg-[#0c0f16] border border-[#161B26] p-3 rounded-2xl">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">6mo Total Direct</p>
                <p className="text-base font-extrabold text-slate-300 mt-1">{formatCurrency(dynamicAverages.kaitlynTotal)}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Monthly Net Income Input</span>
                <span className="font-bold text-white">{formatCurrency(kaitlynNetIncome)}</span>
              </div>
              <input
                type="range"
                min="3000"
                max="15000"
                step="100"
                value={kaitlynGrossIncome}
                onChange={(e) => setKaitlynGrossIncome(Number(e.target.value))}
                className="w-full h-1.5 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-neon-indigo"
              />
            </div>

            <div className="bg-obsidian-850 p-3.5 rounded-2xl border border-obsidian-800 text-[11px] text-slate-350 flex flex-col gap-1.5">
              <div className="flex justify-between font-medium">
                <span>Direct Deposit target:</span>
                <span className="text-white font-bold">{resolvedPartnerAName} Bank Checking</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Routing to Joint:</span>
                <span className="text-neon-indigo font-bold">{kaitlynWFTransferPct}% ({formatCurrency(kaitlynToWF)})</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Partner B Income Card */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-800/40 pb-4 mb-4">
            <div>
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Partner B</span>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mt-0.5">{resolvedPartnerBName} ({resolvedPartnerBEmployer})</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-400 bg-obsidian-800 border border-slate-700/30 px-2.5 py-0.5 rounded-full">
              3-Way Split: Joint, Mortgage, Personal
            </span>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0c0f16] border border-[#161B26] p-3 rounded-2xl">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Dynamic Avg (6mo)</p>
                <p className="text-base font-extrabold text-slate-200 mt-1">{formatCurrency(dynamicAverages.toddIncome)}/mo</p>
              </div>
              <div className="bg-[#0c0f16] border border-[#161B26] p-3 rounded-2xl">
                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">6mo Total Direct</p>
                <p className="text-base font-extrabold text-slate-300 mt-1">{formatCurrency(dynamicAverages.toddTotal)}</p>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Monthly Net Income Input</span>
                <span className="font-bold text-white">{formatCurrency(toddNetIncome)}</span>
              </div>
              <input
                type="range"
                min="4000"
                max="20000"
                step="100"
                value={toddGrossIncome}
                onChange={(e) => setToddGrossIncome(Number(e.target.value))}
                className="w-full h-1.5 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-neon-indigo"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Paycheck Joint Transfer Amount</span>
                <span className="font-bold text-neon-emerald">{formatCurrency(toddJointTransferAmt)} / paycheck</span>
              </div>
              <input
                type="range"
                min="0"
                max="5000"
                step="50"
                value={toddJointTransferAmt}
                onChange={(e) => setToddJointTransferAmt(Number(e.target.value))}
                className="w-full h-1.5 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-neon-emerald"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-400 font-bold block">Deposit Frequency</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { value: 1, label: 'Monthly' },
                  { value: 2, label: 'Twice Monthly' },
                  { value: 2.167, label: 'Bi-Weekly' }
                ].map((freq) => (
                  <button
                    key={freq.value}
                    type="button"
                    onClick={() => setToddPaychecksPerMonth(freq.value)}
                    className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition-all ${
                      toddPaychecksPerMonth === freq.value
                        ? 'bg-neon-emerald/15 border-neon-emerald/40 text-white'
                        : 'bg-obsidian-900 border-obsidian-800 text-slate-400 hover:bg-obsidian-850 hover:text-white'
                    }`}
                  >
                    {freq.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="text-[10px] text-slate-450 bg-[#0c0f16] border border-[#161B26] p-3 rounded-2xl space-y-1">
              <p className="font-bold text-slate-300 uppercase tracking-wider">3-Way Split Breakdown:</p>
              <div className="flex justify-between">
                <span>1. Route to Joint:</span>
                <span className="font-bold text-white">{formatCurrency(toddToJoint)} ({toddNetIncome > 0 ? ((toddToJoint / toddNetIncome) * 100).toFixed(0) : 0}%)</span>
              </div>
              <div className="flex justify-between">
                <span>2. Manual Mortgage:</span>
                <span className="font-bold text-white">{formatCurrency(mortgagePayment)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800/40 pt-1 mt-1">
                <span>3. Personal Savings:</span>
                <span className="font-bold text-emerald-400">{formatCurrency(Math.max(0, toddToPersonal - mortgagePayment))}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Account Inflow & Routing Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-1.5">
              <PiggyBank className="text-neon-indigo" size={16} />
              <span>Joint vs Personal Inflow Splits</span>
            </h3>
            
            <div className="space-y-4">
              <div className="bg-[#0c0f16] border border-[#161B26] p-4 rounded-2xl space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Joint SoFi/Chase Inflows</span>
                  <span className="text-white font-extrabold">{formatCurrency(totalJointInflow)} ({totalNetIncome > 0 ? ((totalJointInflow / totalNetIncome) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div className="w-full bg-obsidian-900 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-neon-indigo transition-all duration-300"
                    style={{ width: `${totalNetIncome > 0 ? (totalJointInflow / totalNetIncome) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{resolvedPartnerAName} contribution: {formatCurrency(kaitlynToJoint)}</span>
                  <span>{resolvedPartnerBName} contribution: {formatCurrency(toddToJoint)}</span>
                </div>
              </div>

              <div className="bg-[#0c0f16] border border-[#161B26] p-4 rounded-2xl space-y-3">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{resolvedPartnerBName} Personal Bank Inflows</span>
                  <span className="text-white font-extrabold">{formatCurrency(totalPersonalInflow)} ({totalNetIncome > 0 ? ((totalPersonalInflow / totalNetIncome) * 100).toFixed(0) : 0}%)</span>
                </div>
                <div className="w-full bg-obsidian-900 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-neon-emerald transition-all duration-300"
                    style={{ width: `${totalNetIncome > 0 ? (totalPersonalInflow / totalNetIncome) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>Stay-in-Personal: {formatCurrency(toddToPersonal)}</span>
                  <span>Used for: Mortgage ({formatCurrency(mortgagePayment)}) + Personal savings</span>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Current Account Holdings */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Parsed Account Balances
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-neon-indigo shrink-0" />
                  <span className="text-xs text-slate-400 font-semibold">Joint Cash (SoFi/Chase)</span>
                </div>
                <span className="text-sm font-bold text-white">{formatCurrency(accountBalances.joint)}</span>
              </div>

              <div className="flex items-center justify-between border-b border-slate-800/40 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-neon-emerald shrink-0" />
                  <span className="text-xs text-slate-400 font-semibold">Personal (BoFA/Vanguard)</span>
                </div>
                <span className="text-sm font-bold text-white">{formatCurrency(accountBalances.personal)}</span>
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded bg-slate-600 shrink-0" />
                  <span className="text-xs text-slate-400 font-semibold">Total Accounts Sum</span>
                </div>
                <span className="text-sm font-black text-neon-emerald">{formatCurrency(accountBalances.joint + accountBalances.personal)}</span>
              </div>
            </div>
          </div>
          
          <div className="mt-4 bg-obsidian-850 border border-obsidian-800 p-3 rounded-2xl text-[10px] text-slate-455">
            Balances extracted live from active database with typical defaults.
          </div>
        </Card>
      </div>

      {/* Custom SVG Sankey Flow Diagram */}
      <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl">
        <div className="flex items-center justify-between border-b border-slate-800/40 pb-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Banking & Flow Map</h3>
            <p className="text-[10px] text-slate-500 mt-1">
              Visualizes path from employer payroll (Havas/BD) to intermediate banks, joint vs personal pools, spending, and surplus.
            </p>
          </div>
        </div>

        {/* Responsive Custom Flow diagram container */}
        <div className="w-full overflow-x-auto py-4 bg-obsidian-950/20 rounded-2xl border border-obsidian-900/60">
          <div className="min-w-[880px] px-4">
            <svg viewBox="0 0 880 320" className="w-full max-w-[880px] h-auto block mx-auto">
            {/* GRADIENTS */}
            <defs>
              <linearGradient id="g-havas-wf" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#818CF8" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#4F46E5" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="g-wf-joint" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#4F46E5" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="g-bd-joint" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.6" />
              </linearGradient>
              <linearGradient id="g-bd-personal" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#34D399" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="g-joint-spending" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366F1" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="g-personal-spending" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34D399" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#EF4444" stopOpacity="0.5" />
              </linearGradient>
              <linearGradient id="g-personal-savings" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#34D399" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.6" />
              </linearGradient>
            </defs>

            {/* FLOW LINES / CURVES */}
            {/* Kaitlyn Havas to WF Checking */}
            <path
              d="M 120 70 C 180 70, 180 70, 240 70"
              fill="none"
              stroke="url(#g-havas-wf)"
              strokeWidth={Math.max(4, Math.min(25, (kaitlynNetIncome / 1000) * 2))}
            />
            {/* WF Checking to Joint SoFi/Chase */}
            <path
              d="M 340 70 C 400 70, 400 110, 460 110"
              fill="none"
              stroke="url(#g-wf-joint)"
              strokeWidth={Math.max(4, Math.min(25, (kaitlynToJoint / 1000) * 2))}
            />
            {/* Todd BD to Joint SoFi/Chase */}
            <path
              d="M 120 220 C 240 220, 360 150, 460 150"
              fill="none"
              stroke="url(#g-bd-joint)"
              strokeWidth={Math.max(4, Math.min(25, (toddToJoint / 1000) * 2))}
            />
            {/* Todd BD to Personal BoFA */}
            <path
              d="M 120 240 C 240 240, 240 260, 460 260"
              fill="none"
              stroke="url(#g-bd-personal)"
              strokeWidth={Math.max(4, Math.min(25, (toddToPersonal / 1000) * 2))}
            />
            {/* Joint SoFi/Chase to Joint Spending */}
            <path
              d="M 580 130 C 640 130, 680 75, 740 75"
              fill="none"
              stroke="url(#g-joint-spending)"
              strokeWidth={Math.max(4, Math.min(20, (jointSpending / 1000) * 2))}
            />
            {/* Personal BoFA to Mortgage ($2,259.97) */}
            <path
              d="M 580 250 C 640 250, 680 175, 740 175"
              fill="none"
              stroke="url(#g-personal-spending)"
              strokeWidth={10}
            />
            {/* Personal BoFA to Forced Savings & Surplus */}
            <path
              d="M 580 270 C 640 270, 680 270, 740 270"
              fill="none"
              stroke="url(#g-personal-savings)"
              strokeWidth={Math.max(4, Math.min(20, ((totalPersonalInflow - mortgagePayment) / 1000) * 2))}
            />

            {/* FLOW NODES */}
            {/* Column 1: Sources */}
            <g transform="translate(10, 40)">
              <rect width="110" height="60" rx="8" fill="#1E1E2E" stroke="#818CF8" strokeWidth="1" />
              <text x="55" y="25" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">{resolvedPartnerAName} ({resolvedPartnerAEmployer})</text>
              <text x="55" y="45" textAnchor="middle" fill="#818CF8" fontSize="11" fontWeight="extrabold">{formatCurrency(kaitlynNetIncome)}</text>
            </g>
            <g transform="translate(10, 195)">
              <rect width="110" height="60" rx="8" fill="#1E1E2E" stroke="#10B981" strokeWidth="1" />
              <text x="55" y="25" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">{resolvedPartnerBName} ({resolvedPartnerBEmployer})</text>
              <text x="55" y="45" textAnchor="middle" fill="#10B981" fontSize="11" fontWeight="extrabold">{formatCurrency(toddNetIncome)}</text>
            </g>

            {/* Column 2: Intermediate Wells Fargo */}
            <g transform="translate(240, 40)">
              <rect width="100" height="60" rx="8" fill="#1E1E2E" stroke="#4F46E5" strokeWidth="1" />
              <text x="50" y="25" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">{resolvedPartnerAName} Bank</text>
              <text x="50" y="45" textAnchor="middle" fill="#4F46E5" fontSize="11" fontWeight="extrabold">{formatCurrency(kaitlynToWF)}</text>
            </g>

            {/* Column 3: Joint vs Personal Pools */}
            <g transform="translate(460, 100)">
              <rect width="120" height="70" rx="8" fill="#1E1E2E" stroke="#6366F1" strokeWidth="1" />
              <text x="60" y="25" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">Joint Account</text>
              <text x="60" y="45" textAnchor="middle" fill="#6366F1" fontSize="11" fontWeight="extrabold">{formatCurrency(totalJointInflow)}</text>
              <text x="60" y="60" textAnchor="middle" fill="#94A3B8" fontSize="8">({totalNetIncome > 0 ? ((totalJointInflow / totalNetIncome) * 100).toFixed(0) : 0}% Inflow)</text>
            </g>
            <g transform="translate(460, 225)">
              <rect width="120" height="70" rx="8" fill="#1E1E2E" stroke="#34D399" strokeWidth="1" />
              <text x="60" y="25" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">{resolvedPartnerBName} Bank</text>
              <text x="60" y="45" textAnchor="middle" fill="#34D399" fontSize="11" fontWeight="extrabold">{formatCurrency(totalPersonalInflow)}</text>
              <text x="60" y="60" textAnchor="middle" fill="#94A3B8" fontSize="8">({totalNetIncome > 0 ? ((totalPersonalInflow / totalNetIncome) * 100).toFixed(0) : 0}% Inflow)</text>
            </g>

            {/* Column 4: Destinations */}
            <g transform="translate(740, 45)">
              <rect width="130" height="50" rx="8" fill="#1E1E2E" stroke="#F59E0B" strokeWidth="1" />
              <text x="65" y="20" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">Joint Spending</text>
              <text x="65" y="38" textAnchor="middle" fill="#F59E0B" fontSize="11" fontWeight="extrabold">{formatCurrency(jointSpending)}</text>
            </g>
            <g transform="translate(740, 145)">
              <rect width="130" height="50" rx="8" fill="#1E1E2E" stroke="#EF4444" strokeWidth="1" />
              <text x="65" y="20" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">Mortgage</text>
              <text x="65" y="38" textAnchor="middle" fill="#EF4444" fontSize="11" fontWeight="extrabold">{formatCurrency(mortgagePayment)}</text>
            </g>
            <g transform="translate(740, 235)">
              <rect width="130" height="60" rx="8" fill="#1E1E2E" stroke="#10B981" strokeWidth="1" />
              <text x="65" y="20" textAnchor="middle" fill="#E2E8F0" fontSize="10" fontWeight="bold">Savings & Surplus</text>
              <text x="65" y="38" textAnchor="middle" fill="#10B981" fontSize="11" fontWeight="extrabold">{formatCurrency(totalPersonalInflow - mortgagePayment)}</text>
              <text x="65" y="50" textAnchor="middle" fill="#94A3B8" fontSize="8">Personal spend/save</text>
            </g>
          </svg>
          </div>
        </div>
      </Card>

      {/* Spending Split by Joint vs Personal Account */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Spending Category Ranges */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
            Spending Allocation Settings
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Joint Monthly Spending (Groceries, Dining, Travel, Costco, Misc)</span>
                <span className="font-bold text-white">{formatCurrency(jointSpending)}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="10000"
                step="100"
                value={jointSpendingSettings}
                onChange={(e) => setJointSpendingSettings(Number(e.target.value))}
                className="w-full h-1.5 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-neon-indigo"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Personal Spending (Todd BoFA)</span>
                <span className="font-bold text-white">{formatCurrency(personalSpending)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="6000"
                step="100"
                value={personalSpendingSettings}
                onChange={(e) => setPersonalSpendingSettings(Number(e.target.value))}
                className="w-full h-1.5 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-neon-emerald"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-400">Mortgage Payment (Paid by Todd)</span>
                <span className="font-bold text-white">{formatCurrency(mortgagePayment)}</span>
              </div>
              <input
                type="range"
                min="1000"
                max="5000"
                step="50"
                value={mortgagePayment}
                onChange={(e) => setMortgagePayment(Number(e.target.value))}
                className="w-full h-1.5 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>
        </Card>

        {/* Detailed Breakdown */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl justify-between flex flex-col">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4">
              Spending Breakdown by Account Pool
            </h3>
            <div className="space-y-3.5">
              <div className="flex items-center justify-between text-xs text-slate-455">
                <span>Joint Pool (Groceries, Dining, Travel, Costco/Amazon)</span>
                <span className="font-bold text-white">{formatCurrency(jointSpending)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-455">
                <span>Todd Mortgage Account (Mortgage)</span>
                <span className="font-bold text-white">{formatCurrency(mortgagePayment)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-455">
                <span>Todd Personal Pool (Misc, Personal)</span>
                <span className="font-bold text-white">{formatCurrency(personalSpending)}</span>
              </div>
              <div className="border-t border-slate-800/40 pt-2.5 flex items-center justify-between text-sm font-bold text-slate-200">
                <span>Total Combined Monthly Outflow</span>
                <span className="text-base text-rose-400 font-extrabold">{formatCurrency(totalSpending)}</span>
              </div>
            </div>
          </div>
          <div className="mt-4 bg-rose-500/5 border border-rose-500/10 p-3.5 rounded-2xl text-[11px] text-rose-300 flex items-start gap-2">
            <ShieldAlert size={14} className="shrink-0 mt-0.5" />
            <span>Mortgage obligation of {formatCurrency(mortgagePayment)}/mo represents a direct lien on Todd's personal accounts.</span>
          </div>
        </Card>
      </div>

      {/* Surplus & Investment Calculator */}
      <Card className="bg-[#0B0E14] border border-[#161B26] p-6 rounded-3xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b border-slate-800/40 pb-4 mb-6">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Calculator className="text-neon-indigo" size={16} />
              <span>Surplus & Investment Calculator</span>
            </h3>
            <p className="text-[10px] text-slate-500 mt-1">Formula: Net Income - Total Spending - Forced Savings</p>
          </div>
          <span className="text-[10px] font-bold text-slate-400 bg-obsidian-800 border border-slate-700/30 px-3 py-1 rounded-full flex items-center gap-1">
            <Info size={11} />
            <span>Todd maxes HSA & DCA; both max 401(k)</span>
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Inputs Section */}
          <div className="space-y-4 lg:col-span-2 bg-[#0c0f16] border border-[#161B26] p-4.5 rounded-2xl">
            <h4 className="text-xs font-bold text-slate-350 uppercase tracking-wider mb-2">Forced Savings Variables</h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-455 font-bold flex justify-between">
                  <span>Combined 401(k) Max (Annual / 12)</span>
                  <span className="text-white font-extrabold">{formatCurrency(both401kMax * 12)}/yr</span>
                </label>
                <input
                  type="number"
                  value={Math.round(both401kMax * 12)}
                  onChange={(e) => setBoth401kMax(Number(e.target.value) / 12)}
                  className="w-full bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none focus:border-neon-indigo font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-455 font-bold flex justify-between">
                  <span>Todd HSA Contribution</span>
                  <span className="text-white font-extrabold">{formatCurrency(toddHsaYr)}/yr</span>
                </label>
                <input
                  type="number"
                  value={toddHsaYr}
                  onChange={(e) => setToddHsaYr(Number(e.target.value))}
                  className="w-full bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none focus:border-neon-indigo font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-455 font-bold flex justify-between">
                  <span>Todd DCA Allocation</span>
                  <span className="text-white font-extrabold">{formatCurrency(toddDcaYr)}/yr</span>
                </label>
                <input
                  type="number"
                  value={toddDcaYr}
                  onChange={(e) => setToddDcaYr(Number(e.target.value))}
                  className="w-full bg-obsidian-900 border border-obsidian-800 px-3 py-1.5 rounded-xl text-xs text-white focus:outline-none focus:border-neon-indigo font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <span className="text-[11px] text-slate-500 font-medium block">Monthly Saved Sum</span>
                <div className="w-full bg-obsidian-900 border border-obsidian-850 px-3 py-1.5 rounded-xl text-xs text-slate-350 font-bold">
                  {formatCurrency(totalForcedSavings)}/mo
                </div>
              </div>
            </div>
          </div>

          {/* Results Summary Card */}
          <div className="bg-gradient-to-br from-[#0e1629] to-[#080d1a] border border-obsidian-800 p-5 rounded-2xl flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-widest block">Month-End Math</span>
              <h4 className="text-lg font-black text-white">Surplus Calculations</h4>
              
              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Total Net Inflow</span>
                  <span className="text-white">{formatCurrency(totalNetIncome)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Total Monthly Outflow</span>
                  <span className="text-white">-{formatCurrency(totalSpending)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Pre-Tax 401(k) (Already Deducted)</span>
                  <span className="text-slate-500">{formatCurrency(both401kMax)}</span>
                </div>
                <div className="flex justify-between text-xs font-semibold text-slate-400">
                  <span>Post-Tax Cash Savings (HSA & DCA)</span>
                  <span className="text-white">-{formatCurrency(monthlyHsa + monthlyDca)}</span>
                </div>
                <div className="border-t border-slate-800/60 pt-2 flex justify-between text-sm font-black text-slate-200">
                  <span>Scenario Surplus</span>
                  <span className={`text-base font-black ${surplus >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(surplus)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-[#0B0E14] border border-[#161B26] p-3 rounded-xl space-y-1.5">
              <span className="text-[9px] text-slate-550 font-bold uppercase tracking-wider block">Scenario Invest Recs (60-80%)</span>
              <div className="flex justify-between items-baseline">
                <span className="text-xs font-bold text-white">
                  {formatCurrency(investMin)} - {formatCurrency(investMax)}
                </span>
                <span className="text-[10px] text-slate-500 font-bold">Recommended</span>
              </div>
              <div className="flex justify-between text-[9.5px] text-slate-500 border-t border-slate-800/40 pt-1 mt-1">
                <span>Remaining Excess Cash:</span>
                <span className="text-slate-300 font-semibold">{formatCurrency(excessCash)}</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Connected Surplus Goal Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <SurplusGoalTracker surplusMetrics={surplusMetrics} />
        </div>

        {/* Weekly DCA Calculator Widget */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-5 rounded-3xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 mb-1.5">
              <Zap className="text-amber-400" size={16} />
              <span>Weekly DCA Planner</span>
            </h4>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
              Determine weekly deployment sizes to drip lump sum cash reserves into taxable brokerage accounts (E*TRADE/Fidelity/Robinhood).
            </p>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-455 font-bold flex justify-between">
                  <span>Lump Sum Amount</span>
                  <span className="text-white">{formatCurrency(dcaLumpSum)}</span>
                </label>
                <input
                  type="range"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={dcaLumpSum}
                  onChange={(e) => setDcaLumpSum(Number(e.target.value))}
                  className="w-full h-1 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-455 font-bold flex justify-between">
                  <span>DCA Duration (Weeks)</span>
                  <span className="text-white">{dcaWeeks} Weeks</span>
                </label>
                <input
                  type="range"
                  min="4"
                  max="24"
                  step="2"
                  value={dcaWeeks}
                  onChange={(e) => setDcaWeeks(Number(e.target.value))}
                  className="w-full h-1 bg-obsidian-900 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 bg-amber-500/5 border border-amber-500/10 p-3 rounded-2xl text-[11px] text-amber-300 flex justify-between items-center">
            <span className="font-semibold">Weekly Target Transfer:</span>
            <span className="font-extrabold text-sm text-white">{formatCurrency(dcaWeeks > 0 ? dcaLumpSum / dcaWeeks : 0)}/wk</span>
          </div>
        </Card>

        {/* Ongoing Automatic Monthly Investment Breakdown */}
        <Card className="bg-[#0B0E14] border border-[#161B26] p-5 rounded-3xl flex flex-col justify-between">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5 mb-1.5">
              <CheckCircle className="text-neon-emerald" size={16} />
              <span>Auto-Investment Guidance</span>
            </h4>
            <p className="text-[10px] text-slate-500 leading-relaxed mb-4">
              Ongoing monthly targets mapped to your surplus limits. Schedule transfers post-payroll on the 25th.
            </p>

            <div className="space-y-3 pt-1">
              <div className="flex items-center justify-between border-b border-slate-850/60 pb-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 block">Conservative Auto-Invest</span>
                  <span className="text-[9px] text-slate-500">Leaves safe buffer for travel/dining</span>
                </div>
                <span className="text-sm font-extrabold text-neon-emerald">{formatCurrency(Math.max(0, Math.round(surplus * 0.7)))}/mo</span>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold text-white block">Aggressive Auto-Invest</span>
                  <span className="text-[9px] text-slate-500">Maximizes compound investment velocity</span>
                </div>
                <span className="text-sm font-extrabold text-neon-indigo">{formatCurrency(Math.max(0, Math.round(surplus * 0.9)))}/mo</span>
              </div>
            </div>
          </div>

          <div className="mt-4 bg-obsidian-850 border border-obsidian-800 p-3 rounded-2xl text-[9.5px] text-slate-400">
            Rule of Thumb: Target joint checking → taxable brokerage monthly, sweep personal quarterly.
          </div>
        </Card>
      </div>
    </div>
  );
}
