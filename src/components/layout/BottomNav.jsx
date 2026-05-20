import React from 'react';
import { motion } from 'framer-motion';
import { LayoutDashboard, ReceiptText, PieChart, Waves, ArrowDownRight, ArrowUpRight, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dash', icon: LayoutDashboard },
  { id: 'spending', label: 'Spend', icon: ArrowDownRight },
  { id: 'income', label: 'Income', icon: ArrowUpRight },
  { id: 'transactions', label: 'Txns', icon: ReceiptText },
  { id: 'budgets', label: 'Budgets', icon: PieChart },
  { id: 'cashflow', label: 'Flow', icon: Waves },
  { id: 'settings', label: 'Set', icon: Settings },
];

export default function BottomNav({ currentView, setCurrentView }) {
  return (
    <nav className="md:hidden fixed bottom-0 w-full bg-obsidian-800/90 backdrop-blur-md border-t border-obsidian-700 pb-safe z-50">
      <div className="flex justify-around items-center p-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`relative flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-colors
                ${isActive ? 'text-white' : 'text-slate-400'}
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="active-nav-mobile"
                  className="absolute inset-0 bg-obsidian-700/50 rounded-xl"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}
              <div className="relative z-10 flex flex-col items-center space-y-1">
                <Icon size={20} className={isActive ? 'text-neon-emerald' : ''} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </div>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
