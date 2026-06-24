import React from 'react';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, ReceiptText, PieChart, Waves, ArrowDownRight, 
  ArrowUpRight, Settings, Table, Calendar, Sparkles, CalendarRange, 
  Compass, Landmark, Briefcase
} from 'lucide-react';
import { haptics } from '../../utils/haptics';
import { useAppContext } from '../../context/AppContext';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'accounts', label: 'Accounts', icon: Landmark },
  { id: 'wealth', label: 'Wealth & Portfolio', icon: Briefcase },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'subscriptions', label: 'Subscriptions', icon: CalendarRange },
  { id: 'sankey', label: 'Sankey Flow', icon: Waves },
  { id: 'spending', label: 'Spending', icon: ArrowDownRight },
  { id: 'income', label: 'Income', icon: ArrowUpRight },
  { id: 'plreport', label: 'P&L Report', icon: Table },
  { id: 'yearly', label: 'Yearly Insights', icon: Calendar },
  { id: 'assistant', label: 'Copilot AI', icon: Sparkles },
  { id: 'settings', label: 'Settings', icon: Settings },
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
    <aside className="hidden md:flex flex-col w-64 bg-obsidian-800 border-r border-obsidian-700 h-screen sticky top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-emerald to-neon-indigo">
          FinFlow
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto hide-scrollbar">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => {
                haptics.light();
                setCurrentView(item.id);
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 relative
                ${isActive ? 'text-white' : 'text-slate-400 hover:text-white hover:bg-obsidian-700/50'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav-desktop"
                  className="absolute inset-0 bg-obsidian-700 rounded-xl"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex items-center space-x-3">
                <Icon size={20} className={isActive ? 'text-neon-emerald' : ''} />
                <span className="font-medium">{item.label}</span>
              </div>
            </button>
          );
        })}
      </nav>
      
      <div className="p-4 border-t border-obsidian-700">
        <button
          onClick={() => {
            haptics.light();
            setCurrentView('settings');
          }}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl hover:bg-obsidian-700/50 transition-all cursor-pointer group text-left"
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
