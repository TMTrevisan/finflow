import React, { useState, useRef, useEffect } from 'react';
import { Calendar, ChevronDown, Check, ArrowRight } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';
import { getDateRangeLabel } from '../../utils/dateFilters';

const FILTER_OPTIONS = [
  { id: 'this_week', name: 'This Week' },
  { id: 'this_month', name: 'This Month' },
  { id: 'last_month', name: 'Last Month' },
  { id: 'last_3_months', name: 'Last 3 Months' },
  { id: 'last_6_months', name: 'Last 6 Months' },
  { id: 'this_quarter', name: 'This Quarter' },
  { id: 'ytd', name: 'Year to Date (YTD)' },
  { id: 'last_year', name: 'Last Year' },
  { id: 'all', name: 'All Time' },
  { id: 'custom', name: 'Custom Range' }
];

export default function DateRangeSelector({ 
  filterType, 
  setFilterType, 
  customStart, 
  setCustomStart, 
  customEnd, 
  setCustomEnd 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const { transactions = [] } = useAppContext();

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const activeOption = FILTER_OPTIONS.find(o => o.id === filterType) || FILTER_OPTIONS[1];
  const dateRangeString = getDateRangeLabel(filterType, customStart, customEnd, transactions);

  return (
    <div className="relative inline-block text-left" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2.5 px-4 py-2.5 bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 hover:border-obsidian-600 rounded-xl text-sm font-semibold text-slate-100 hover:text-white transition-all shadow-md focus:outline-none focus:ring-2 focus:ring-neon-indigo/40"
      >
        <Calendar size={16} className="text-neon-indigo" />
        <span>{activeOption.name}</span>
        <span className="text-slate-400 font-normal">({dateRangeString})</span>
        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-obsidian-900 backdrop-blur-md border border-obsidian-750 rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="space-y-1">
            {FILTER_OPTIONS.map((option) => (
              <button
                key={option.id}
                onClick={() => {
                  setFilterType(option.id);
                  if (option.id !== 'custom') {
                    setIsOpen(false);
                  }
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left text-sm font-medium transition-colors ${
                  filterType === option.id
                    ? 'bg-neon-indigo/10 text-neon-indigo'
                    : 'text-slate-300 hover:bg-obsidian-800 hover:text-white'
                }`}
              >
                <span>{option.name}</span>
                {filterType === option.id && <Check size={14} className="text-neon-indigo" />}
              </button>
            ))}
          </div>

          {filterType === 'custom' && (
            <div className="mt-3 pt-3 border-t border-obsidian-800 space-y-3 p-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Custom Range</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                  <input
                    type="date"
                    value={customStart || ''}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-neon-indigo"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                  <input
                    type="date"
                    value={customEnd || ''}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-neon-indigo"
                  />
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-full mt-1 py-1.5 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-semibold rounded-lg transition-colors shadow-md"
              >
                Apply Custom Range
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
