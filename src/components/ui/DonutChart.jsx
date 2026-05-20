import React, { useState } from 'react';
import { formatCurrency } from '../../utils/formatting';

export default function DonutChart({ data, size = 200, strokeWidth = 24 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const total = data.reduce((sum, item) => sum + item.value, 0);

  // Calculate coordinates for circle segments
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  let accumulatedPercent = 0;

  const segments = data.map((item, index) => {
    const percent = total > 0 ? (item.value / total) : 0;
    const strokeLength = percent * circumference;
    const strokeOffset = circumference - strokeLength + (accumulatedPercent * circumference);
    
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

  return (
    <div className="flex flex-col md:flex-row items-center justify-center gap-8 w-full p-4">
      {/* Interactive Donut SVG */}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90 select-none">
          {/* Base track circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#1E293B"
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
                strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                strokeDasharray={circumference}
                strokeDashoffset={segment.strokeOffset}
                strokeLinecap="round"
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredIndex(segment.index)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  filter: isHovered ? `drop-shadow(0px 0px 8px ${segment.color}80)` : 'none',
                }}
              />
            );
          })}
        </svg>

        {/* Center Text displaying hover info or overall total */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none p-4">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
            {activeSegment ? activeSegment.name : 'Total Spending'}
          </span>
          <span className="text-xl md:text-2xl font-black text-white tracking-tight mt-0.5">
            {formatCurrency(activeSegment ? activeSegment.value : total)}
          </span>
          <span className="text-[11px] text-slate-400 font-medium mt-0.5">
            {activeSegment ? `${(activeSegment.percent * 100).toFixed(1)}%` : 'This month'}
          </span>
        </div>
      </div>

      {/* Custom Legend */}
      <div className="flex-1 space-y-3 w-full max-w-xs">
        {segments.map((segment) => {
          const isHovered = hoveredIndex === segment.index;
          return (
            <div
              key={segment.name}
              onMouseEnter={() => setHoveredIndex(segment.index)}
              onMouseLeave={() => setHoveredIndex(null)}
              className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer ${
                isHovered 
                  ? 'bg-obsidian-800 border-obsidian-700 shadow-md scale-[1.02]' 
                  : 'bg-transparent border-transparent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: segment.color }}></span>
                <span className={`text-sm font-semibold transition-colors ${isHovered ? 'text-white' : 'text-slate-300'}`}>
                  {segment.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-white block">
                  {formatCurrency(segment.value)}
                </span>
                <span className="text-[10px] text-slate-500 font-medium">
                  {(segment.percent * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
