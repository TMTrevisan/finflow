import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutDashboard, ReceiptText, Sparkles, MoreHorizontal, X,
  PieChart, Waves, ArrowDownRight, ArrowUpRight, Settings, Table,
  Calendar, CalendarRange
} from 'lucide-react';
import { haptics } from '../../utils/haptics';

const PRIMARY_NAV = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'transactions', label: 'Txns', icon: ReceiptText },
  { id: 'assistant', label: 'Copilot', icon: Sparkles },
  { id: 'more', label: 'More', icon: MoreHorizontal },
];

const MORE_SECTIONS = [
  {
    label: 'Analytics',
    items: [
      { id: 'budgets', label: 'Budgets', icon: PieChart, desc: 'Monthly spending limits' },
      { id: 'spending', label: 'Spending', icon: ArrowDownRight, desc: 'Category breakdown' },
      { id: 'income', label: 'Income', icon: ArrowUpRight, desc: 'Earnings & sources' },
      { id: 'cashflow', label: 'Cash Flow', icon: Waves, desc: 'Income vs. expenses' },
      { id: 'plreport', label: 'P&L Report', icon: Table, desc: 'Profit & Loss' },
      { id: 'yearly', label: 'Yearly', icon: Calendar, desc: 'Year-over-year view' },
    ]
  },
  {
    label: 'Tools',
    items: [
      { id: 'subscriptions', label: 'Subscriptions', icon: CalendarRange, desc: 'Recurring charges' },
      { id: 'settings', label: 'Settings', icon: Settings, desc: 'App configuration' },
    ]
  }
];

export default function BottomNav({ currentView, setCurrentView }) {
  const [showMore, setShowMore] = useState(false);

  const handleNav = (id) => {
    haptics.light();
    if (id === 'more') {
      setShowMore(true);
    } else {
      setShowMore(false);
      setCurrentView(id);
    }
  };

  const handleMoreNav = (id) => {
    haptics.medium();
    setShowMore(false);
    setCurrentView(id);
  };

  // Determine if currentView is in the "more" group
  const moreViewIds = MORE_SECTIONS.flatMap(s => s.items.map(i => i.id));
  const isMoreActive = moreViewIds.includes(currentView);

  return (
    <>
      {/* "More" Full-Screen Drawer */}
      <AnimatePresence>
        {showMore && (
          <motion.div
            initial={{ opacity: 0, y: '100%' }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 35 }}
            className="md:hidden fixed inset-0 z-[60] bg-obsidian-900/97 backdrop-blur-xl flex flex-col"
          >
            {/* Drawer Header */}
            <div className="flex items-center justify-between px-6 pt-12 pb-4 border-b border-obsidian-700/50">
              <h2 className="text-xl font-bold text-white">All Views</h2>
              <button
                onClick={() => setShowMore(false)}
                className="p-2 rounded-xl bg-obsidian-800 border border-obsidian-700 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Grouped items */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              {MORE_SECTIONS.map((section) => (
                <div key={section.label}>
                  <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">
                    {section.label}
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleMoreNav(item.id)}
                          className={`flex items-center space-x-3 p-4 rounded-2xl border transition-all active:scale-[0.97] text-left ${
                            isActive
                              ? 'bg-neon-indigo/15 border-neon-indigo/30 text-white'
                              : 'bg-obsidian-800/50 border-obsidian-700/50 text-slate-300 hover:bg-obsidian-800 hover:text-white'
                          }`}
                        >
                          <div className={`p-2 rounded-xl ${
                            isActive ? 'bg-neon-indigo/20 text-neon-indigo' : 'bg-obsidian-900/50 text-slate-400'
                          }`}>
                            <Icon size={18} />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate">{item.label}</p>
                            <p className="text-[10px] text-slate-500 truncate">{item.desc}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Nav Bar */}
      <nav className="md:hidden fixed bottom-0 w-full bg-obsidian-800/95 backdrop-blur-md border-t border-obsidian-700 z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex justify-around items-center p-2">
          {PRIMARY_NAV.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'more' 
              ? (isMoreActive || showMore)
              : currentView === item.id;

            return (
              <button
                key={item.id}
                onClick={() => handleNav(item.id)}
                className={`relative flex flex-col items-center justify-center w-16 h-14 rounded-xl transition-colors ${
                  isActive ? 'text-white' : 'text-slate-400'
                }`}
              >
                {isActive && !showMore && item.id !== 'more' && (
                  <motion.div
                    layoutId="active-nav-mobile"
                    className="absolute inset-0 bg-obsidian-700/50 rounded-xl"
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                  />
                )}
                {(isActive) && item.id === 'more' && (
                  <div className="absolute inset-0 bg-obsidian-700/50 rounded-xl" />
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
    </>
  );
}
