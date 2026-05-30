import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppContext } from '../../context/AppContext';
import { ChevronDown } from 'lucide-react';
import { cn } from './Card';
import { getCategoryEmoji } from '../../utils/formatting';
import { BottomSheet } from './BottomSheet';

export function CategoryPill({ transaction }) {
  const { categories = [], updateCategory } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const dropdownRef = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Group categories for dropdown
  const groupedCategories = categories.reduce((acc, cat) => {
    if (!acc[cat.group]) acc[cat.group] = [];
    acc[cat.group].push(cat);
    return acc;
  }, {});

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = async (newCatName) => {
    if (newCatName === transaction.category) {
      setIsOpen(false);
      return;
    }
    setIsUpdating(true);
    await updateCategory(transaction.id, newCatName);
    setIsUpdating(false);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isUpdating}
        className={cn(
          "flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-medium transition-all duration-200 border",
          transaction.category === 'Uncategorized' 
            ? "bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20"
            : "bg-obsidian-700 text-slate-300 border-obsidian-600 hover:bg-obsidian-600 hover:text-white",
          isUpdating && "opacity-50 cursor-not-allowed animate-pulse"
        )}
      >
        <span>{getCategoryEmoji(transaction.category)}</span>
        <span>{transaction.category || 'Uncategorized'}</span>
        <ChevronDown size={12} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-2 w-52 bg-obsidian-800 border border-obsidian-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
          >
            <div className="p-1">
              {Object.entries(groupedCategories).map(([group, cats]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {group}
                  </div>
                  {cats.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => handleSelect(cat.category)}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center space-x-2",
                        cat.category === transaction.category
                          ? "bg-neon-indigo/20 text-neon-indigo font-medium"
                          : "text-slate-300 hover:bg-obsidian-700 hover:text-white"
                      )}
                    >
                      <span className="text-base">{getCategoryEmoji(cat.category)}</span>
                      <span>{cat.category}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet
        isOpen={isOpen && isMobile}
        onClose={() => setIsOpen(false)}
        title="Select Category"
      >
        <div className="space-y-4">
          {Object.entries(groupedCategories).map(([group, cats]) => (
            <div key={group} className="space-y-2">
              <div className="px-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                {group}
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {cats.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => handleSelect(cat.category)}
                    className={cn(
                      "w-full text-left px-4 py-3.5 text-sm rounded-2xl transition-colors flex items-center space-x-3 border",
                      cat.category === transaction.category
                        ? "bg-neon-indigo/20 text-neon-indigo font-medium border-neon-indigo/35"
                        : "bg-obsidian-800 text-slate-300 hover:bg-obsidian-700 hover:text-white border-obsidian-750"
                    )}
                  >
                    <span className="text-lg">{getCategoryEmoji(cat.category)}</span>
                    <span>{cat.category}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
