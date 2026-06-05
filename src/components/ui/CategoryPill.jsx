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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Filter categories based on search query
  const filteredCategories = categories.filter(cat => 
    cat.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    cat.group.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group filtered categories for dropdown
  const groupedCategories = filteredCategories.reduce((acc, cat) => {
    if (!acc[cat.group]) acc[cat.group] = [];
    acc[cat.group].push(cat);
    return acc;
  }, {});

  // Reset search and focus on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      const timer = setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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

  const handleKeyDown = (e) => {
    // Prevent any keydown propagation to prevent parent layouts/shortcuts from triggering
    e.stopPropagation();

    if (filteredCategories.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % filteredCategories.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCategories.length) % filteredCategories.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = filteredCategories[selectedIndex];
      if (selected) {
        handleSelect(selected.category);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef} onKeyDown={(e) => e.stopPropagation()}>
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
        <span className="truncate max-w-[90px]" title={transaction.category || 'Uncategorized'}>
          {transaction.category || 'Uncategorized'}
        </span>
        <ChevronDown size={12} className={cn("transition-transform duration-200", isOpen && "rotate-180")} />
      </button>

      <AnimatePresence>
        {isOpen && !isMobile && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            onKeyDown={handleKeyDown}
            className="absolute z-50 mt-2 w-52 bg-obsidian-800 border border-obsidian-700 rounded-xl shadow-2xl overflow-hidden max-h-64 overflow-y-auto"
          >
            <div className="sticky top-0 bg-obsidian-800 p-1.5 border-b border-obsidian-700 z-10">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search category..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                className="w-full bg-obsidian-900 text-slate-100 placeholder-slate-500 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-neon-indigo border border-obsidian-750"
              />
            </div>
            <div className="p-1">
              {Object.entries(groupedCategories).map(([group, cats]) => (
                <div key={group} className="mb-2 last:mb-0">
                  <div className="px-2 py-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    {group}
                  </div>
                  {cats.map(cat => {
                    const isHighlighted = filteredCategories[selectedIndex]?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelect(cat.category)}
                        onKeyDown={handleKeyDown}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center space-x-2",
                          cat.category === transaction.category
                            ? "bg-neon-indigo/20 text-neon-indigo font-medium"
                            : isHighlighted
                              ? "bg-obsidian-700 text-white font-medium border-l-2 border-neon-indigo pl-2.5"
                              : "text-slate-300 hover:bg-obsidian-700 hover:text-white"
                        )}
                      >
                        <span className="text-base">{getCategoryEmoji(cat.category)}</span>
                        <span>{cat.category}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
              {filteredCategories.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-slate-500">
                  No categories found
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <BottomSheet
        isOpen={isOpen && isMobile}
        onClose={() => setIsOpen(false)}
        title="Select Category"
      >
        <div className="space-y-4" onKeyDown={handleKeyDown}>
          <div className="px-1 mb-2">
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search category..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-obsidian-900 text-slate-100 placeholder-slate-500 text-sm rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-neon-indigo border border-obsidian-700"
            />
          </div>
          <div className="max-h-96 overflow-y-auto pr-1">
            {Object.entries(groupedCategories).map(([group, cats]) => (
              <div key={group} className="space-y-2 mb-4">
                <div className="px-1 text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                  {group}
                </div>
                <div className="grid grid-cols-1 gap-1.5">
                  {cats.map(cat => {
                    const isHighlighted = filteredCategories[selectedIndex]?.id === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleSelect(cat.category)}
                        onKeyDown={handleKeyDown}
                        className={cn(
                          "w-full text-left px-4 py-3.5 text-sm rounded-2xl transition-colors flex items-center space-x-3 border",
                          cat.category === transaction.category
                            ? "bg-neon-indigo/20 text-neon-indigo font-medium border-neon-indigo/35"
                            : isHighlighted
                              ? "bg-obsidian-850 text-white font-medium border-neon-indigo/50"
                              : "bg-obsidian-800 text-slate-300 hover:bg-obsidian-700 hover:text-white border-obsidian-750"
                        )}
                      >
                        <span className="text-lg">{getCategoryEmoji(cat.category)}</span>
                        <span>{cat.category}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {filteredCategories.length === 0 && (
              <div className="py-8 text-center text-sm text-slate-500">
                No categories found
              </div>
            )}
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}
