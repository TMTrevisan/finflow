import React from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, ReceiptText, PieChart, Waves, ArrowDownRight, 
  ArrowUpRight, Settings, Table, Calendar, Sparkles, CalendarRange, 
  Compass, Landmark, Briefcase
} from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { useAppContext } from '../../context/AppContext';

const NAV_GROUPS = [
  {
    title: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'insights', label: 'Insights Hub', icon: Compass },
      { id: 'accounts', label: 'Accounts', icon: Landmark },
      { id: 'wealth', label: 'Wealth & Portfolio', icon: Briefcase },
      { id: 'transactions', label: 'Transactions', icon: ReceiptText },
    ]
  },
  {
    title: 'Planning & Flow',
    items: [
      { id: 'budgets', label: 'Budgets', icon: PieChart },
      { id: 'subscriptions', label: 'Subscriptions', icon: CalendarRange },
      { id: 'sankey', label: 'Sankey Flow', icon: Waves },
    ]
  },
  {
    title: 'Analysis',
    items: [
      { id: 'spending', label: 'Spending', icon: ArrowDownRight },
      { id: 'income', label: 'Income', icon: ArrowUpRight },
      { id: 'plreport', label: 'P&L Report', icon: Table },
      { id: 'yearly', label: 'Yearly Insights', icon: Calendar },
    ]
  },
  {
    title: 'Intelligence',
    items: [
      { id: 'assistant', label: 'Copilot AI', icon: Sparkles },
    ]
  }
];

export default function Sidebar({ currentView, setCurrentView }) {
  const { 
    resolvedPartnerAName = "Wife",
    resolvedPartnerBName = "Husband"
  } = useAppContext() || {};

  const initials = resolvedPartnerBName && resolvedPartnerAName 
    ? `${resolvedPartnerBName[0]}${resolvedPartnerAName[0]}`
    : "U";

  const displayName = resolvedPartnerBName && resolvedPartnerAName
    ? `${resolvedPartnerBName} & ${resolvedPartnerAName}`
    : "User Profile";

  return (
    <aside className="hidden md:flex flex-col w-64 bg-obsidian-900 border-r border-obsidian-750 h-screen sticky top-0">
      <div className="p-6 pb-2">
        <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-neon-emerald to-neon-indigo">
          FinFlow
        </h1>
      </div>
      
      <nav className="flex-1 px-4 py-3 space-y-6 overflow-y-auto hide-scrollbar">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <h3 className="px-4 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      haptics.light();
                      setCurrentView(item.id);
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all duration-200 relative
                      ${isActive 
                        ? 'text-slate-900 dark:text-white font-bold' 
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-obsidian-800/50'}
                    `}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-desktop"
                        className="absolute inset-0 bg-obsidian-800 rounded-xl"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    <div className="relative z-10 flex items-center space-x-3">
                      <Icon 
                        size={18} 
                        className={isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-200 dark:hover:text-white'} 
                        aria-hidden="true" 
                      />
                      <span className={`text-xs font-semibold ${isActive ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-200 dark:hover:text-white'}`}>
                        {item.label}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      
      <div className="p-4 border-t border-obsidian-750">
        <button
          onClick={() => {
            haptics.light();
            setCurrentView('settings');
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-obsidian-800/50 transition-all cursor-pointer group text-left"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neon-indigo to-neon-violet flex items-center justify-center text-xs font-bold text-white shrink-0 group-hover:scale-105 transition-transform">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-slate-100 truncate group-hover:text-neon-indigo transition-colors">{displayName}</p>
            <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">Settings Dashboard</p>
          </div>
        </button>
      </div>
    </aside>
  );
}
