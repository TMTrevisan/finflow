import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, ReceiptText, PieChart, Waves, ArrowDownRight, ArrowUpRight, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'spending', label: 'Spending', icon: ArrowDownRight },
  { id: 'income', label: 'Income', icon: ArrowUpRight },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'cashflow', label: 'Cash Flow', icon: Waves },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export default function Sidebar({ currentView, setCurrentView }) {
  return (
    <aside className="hidden md:flex flex-col w-64 bg-obsidian-800 border-r border-obsidian-700 h-screen sticky top-0">
      <div className="p-6">
        <h1 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-neon-emerald to-neon-indigo">
          FinFlow
        </h1>
      </div>
      
      <nav className="flex-1 px-4 space-y-2 mt-4">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
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
        <div className="flex items-center space-x-3 px-4 py-2">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-neon-indigo to-neon-violet flex items-center justify-center text-sm font-bold">
            U
          </div>
          <span className="text-sm font-medium text-slate-300">User</span>
        </div>
      </div>
    </aside>
  );
}
