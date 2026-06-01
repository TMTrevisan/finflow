import React, { useState } from 'react';
import { formatCurrency, cleanMerchantName, formatDate } from '../../utils/formatting';
import { getCategoryConfig } from '../../utils/categoryHelpers';

export default function DonutChart({ 
  data = [], 
  size = 220, 
  strokeWidth = 16, 
  centerLabel = 'Total Spending',
  centerSublabel = 'This month',
  transactions = [] // Optional: if provided, enables clicking legend items to see matching transactions
}) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);

  // Filter out any zero or negative values for chart logic
  const chartData = data.filter(item => item.value > 0);
  const total = chartData.reduce((sum, item) => sum + item.value, 0);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Use a clean visual gap between segments (in pixels along the circumference)
  const gap = chartData.length > 1 ? 12 : 0;
  
  let accumulatedPercent = 0;

  const segments = chartData.map((item, index) => {
    const percent = total > 0 ? (item.value / total) : 0;
    
    // Formula: visual length of segment = percent * circumference - gap
    // strokeLength = visual length - strokeWidth (since round caps add strokeWidth/2 on each side)
    const strokeLength = percent > 0 
      ? Math.max(0.1, (percent * circumference) - gap - strokeWidth) 
      : 0;
      
    // Shift drawing start forward by (strokeWidth + gap) / 2 to center the segment in its sector
    const drawingStart = (accumulatedPercent * circumference) + (gap / 2) + (strokeWidth / 2);
    const strokeOffset = -drawingStart;

    accumulatedPercent += percent;

    return {
      ...item,
      strokeLength,
      strokeOffset,
      percent,
      index
    };
  });

  const activeSegment = hoveredIndex !== null ? segments[hoveredIndex] : null;

  const toggleCategoryExpand = (name) => {
    if (transactions.length === 0) return;
    setExpandedCategory(expandedCategory === name ? null : name);
  };

  return (
    <div className="flex flex-col items-center justify-center w-full p-2">
      {/* Interactive Donut SVG */}
      <div className="relative mb-6" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 select-none">
          {/* Base track circle (sleek dark background) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--obsidian-800)"
            strokeWidth={strokeWidth}
          />
          
          {segments.map((segment) => {
            const isHovered = hoveredIndex === segment.index;
            
            return (
              <circle
                key={segment.name}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color || '#6366F1'}
                strokeWidth={isHovered ? strokeWidth + 3 : strokeWidth}
                strokeDasharray={`${segment.strokeLength} ${circumference}`}
                strokeDashoffset={segment.strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-305 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(segment.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  filter: isHovered ? `drop-shadow(0px 0px 8px ${segment.color}90)` : 'none',
                }}
              />
            );
          })}
        </svg>

        {/* Center Text displaying hover info or overall total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest transition-all duration-200">
            {activeSegment ? activeSegment.name : centerLabel}
          </span>
          <span className="text-xl md:text-2xl font-black text-white tracking-tight mt-1 transition-all duration-200">
            {formatCurrency(activeSegment ? activeSegment.value : total)}
          </span>
          <span className="text-[10px] text-slate-400 font-medium mt-0.5 opacity-80">
            {activeSegment ? `${(activeSegment.percent * 100).toFixed(1)}%` : centerSublabel}
          </span>
        </div>
      </div>

      {/* Premium Vertical Legend List */}
      <div className="w-full max-w-2xl space-y-2.5 mt-4">
        {segments.map((segment) => {
          const isHovered = hoveredIndex === segment.index;
          const isExpanded = expandedCategory === segment.name;
          const config = getCategoryConfig(segment.name);
          const IconComponent = config.icon;

          // Filter transactions for this category
          const categoryTxns = transactions.filter(t => t.category === segment.name);

          return (
            <div
              key={segment.name}
              onMouseEnter={() => setHoveredIndex(segment.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex flex-col p-2.5 sm:p-3.5 rounded-2xl border transition-all duration-200 ${
                transactions.length > 0 ? 'cursor-pointer' : ''
              } ${
                isHovered || isExpanded
                  ? 'bg-obsidian-800 border-opacity-100 shadow-lg'
                  : 'bg-obsidian-850/40 border-obsidian-800/80 text-slate-400 hover:text-slate-200 hover:border-obsidian-750'
              }`}
              style={{
                borderColor: isHovered || isExpanded ? segment.color : undefined,
                boxShadow: isHovered || isExpanded ? `0 0 12px ${segment.color}15` : undefined
              }}
              onClick={() => toggleCategoryExpand(segment.name)}
            >
              {/* Row: Header Summary */}
              <div className="flex items-center justify-between w-full">
                {/* Left Side: Icon + Name */}
                <div className="flex items-center space-x-2 sm:space-x-3.5 min-w-0 flex-1 mr-2">
                  <div 
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-obsidian-900 border shrink-0"
                    style={{ borderColor: `${segment.color}25` }}
                  >
                    {IconComponent ? (
                      <IconComponent size={13} className="sm:w-3.5 sm:h-3.5" style={{ color: segment.color }} />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: segment.color }} />
                    )}
                  </div>
                  <span className="font-semibold text-xs sm:text-sm truncate text-slate-100">{segment.name}</span>
                </div>

                {/* Middle: Proportion Progress Bar */}
                <div className="flex-1 mx-4 hidden sm:block">
                  <div className="h-1.5 w-full bg-obsidian-900 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all duration-500"
                      style={{ 
                        width: `${(segment.percent * 100).toFixed(1)}%`,
                        backgroundColor: segment.color 
                      }}
                    />
                  </div>
                </div>

                {/* Right Side: Amount + Percentage */}
                <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 text-right">
                  <span className="font-bold text-xs sm:text-sm text-white">{formatCurrency(segment.value)}</span>
                  <span className="text-[10px] sm:text-xs font-semibold text-slate-500 min-w-[28px] sm:min-w-[36px]">
                    {(segment.percent * 100).toFixed(0)}%
                  </span>
                  {transactions.length > 0 && (
                    <span className="text-[9px] sm:text-[10px] text-slate-600 transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(90deg)' : 'none' }}>▶</span>
                  )}
                </div>
              </div>

              {/* Expanded details list */}
              {isExpanded && categoryTxns.length > 0 && (
                <div 
                  className="mt-2.5 px-1 py-1.5 bg-obsidian-900/40 rounded-xl border border-obsidian-800/60 space-y-1 max-h-96 overflow-y-auto custom-scrollbar w-full"
                  onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inner items
                >
                  {categoryTxns
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .map(t => (
                      <div key={t.id} className="flex justify-between items-center text-xs text-slate-400 py-2.5 border-b border-obsidian-800/20 last:border-b-0 w-full px-1.5">
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-slate-250 text-xs sm:text-sm truncate">{cleanMerchantName(t.description)}</p>
                          <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 flex flex-wrap gap-1 items-center">
                            <span>{formatDate(t.date)}</span>
                            <span>•</span>
                            <span className="truncate">{t.account}</span>
                          </p>
                        </div>
                        <span className="font-black text-slate-100 text-xs sm:text-sm ml-2.5 shrink-0">{formatCurrency(Math.abs(t.amount))}</span>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

