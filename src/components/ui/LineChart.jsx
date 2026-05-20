import React, { useState, useRef, useMemo } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatting';

export default function LineChart({ data, height = 240 }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const containerRef = useRef(null);

  const points = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    const minVal = Math.min(...data.map(d => d.netWorth));
    const maxVal = Math.max(...data.map(d => d.netWorth));
    const valueRange = maxVal - minVal || 1;

    // Add padding to top and bottom of chart bounds
    const chartMin = minVal - valueRange * 0.1;
    const chartMax = maxVal + valueRange * 0.1;
    const chartRange = chartMax - chartMin;

    const width = 800; // base svg coordinate system width
    const svgHeight = height;

    const margin = { top: 20, right: 30, bottom: 30, left: 30 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = svgHeight - margin.top - margin.bottom;

    return data.map((d, index) => {
      const x = margin.left + (index / (data.length - 1)) * chartWidth;
      const y = margin.top + chartHeight - ((d.netWorth - chartMin) / chartRange) * chartHeight;
      return {
        x,
        y,
        date: d.date,
        value: d.netWorth,
        assets: d.assets,
        liabilities: d.liabilities,
        originalData: d
      };
    });
  }, [data, height]);

  // Construct SVG Path using Bezier curves for a smooth curve
  const pathD = useMemo(() => {
    if (points.length === 0) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      // Control points for smooth bezier curve
      const cpX1 = curr.x + (next.x - curr.x) / 3;
      const cpY1 = curr.y;
      const cpX2 = curr.x + 2 * (next.x - curr.x) / 3;
      const cpY2 = next.y;
      d += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${next.x} ${next.y}`;
    }
    return d;
  }, [points]);

  // Gradient area path definition
  const areaD = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    const last = points[points.length - 1];
    return `${pathD} L ${last.x} ${height - 30} L ${first.x} ${height - 30} Z`;
  }, [points, pathD, height]);

  const handleMouseMove = (e) => {
    if (!containerRef.current || points.length === 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const svgWidth = 800; // coordinate system width
    
    // Scale user cursor X position to SVG coordinate system X
    const cursorX = ((e.clientX - rect.left) / rect.width) * svgWidth;
    
    // Find the closest point in the points array
    let closest = points[0];
    let minDistance = Math.abs(points[0].x - cursorX);
    
    for (let i = 1; i < points.length; i++) {
      const distance = Math.abs(points[i].x - cursorX);
      if (distance < minDistance) {
        closest = points[i];
        minDistance = distance;
      }
    }
    
    setHoveredPoint(closest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center bg-obsidian-800/20 rounded-2xl border border-obsidian-700/50" style={{ height }}>
        <p className="text-slate-500 text-sm">No historical data available</p>
      </div>
    );
  }

  return (
    <div className="relative w-full">
      {/* Tooltip Hover Overlay */}
      {hoveredPoint && (
        <div 
          className="absolute z-10 bg-obsidian-800/95 backdrop-blur border border-obsidian-700 rounded-xl p-3 shadow-2xl pointer-events-none transition-all duration-150"
          style={{
            left: `${((hoveredPoint.x - 30) / 800) * 100}%`,
            top: `${Math.max(10, hoveredPoint.y - 100)}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
            {formatDate(hoveredPoint.date)}
          </div>
          <div className="text-base font-bold text-white mb-0.5">
            {formatCurrency(hoveredPoint.value)}
          </div>
          <div className="flex space-x-3 text-xs text-slate-400">
            <span>Assets: <span className="text-neon-emerald font-medium">{formatCurrency(hoveredPoint.assets)}</span></span>
            <span>Liabs: <span className="text-neon-crimson font-medium">{formatCurrency(hoveredPoint.liabilities)}</span></span>
          </div>
        </div>
      )}

      {/* SVG Line Chart */}
      <svg
        ref={containerRef}
        viewBox={`0 0 800 ${height}`}
        className="w-full h-auto cursor-crosshair select-none"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          {/* Main line glow */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="#6366F1" floodOpacity="0.4" />
          </filter>
          
          {/* Fill gradient under line */}
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6366F1" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = 20 + r * (height - 50);
          return (
            <line
              key={i}
              x1="30"
              y1={y}
              x2="770"
              y2={y}
              stroke="#1E293B"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {/* Shaded Area under the line */}
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Smooth Curved Line */}
        <path
          d={pathD}
          fill="none"
          stroke="url(#lineGrad)"
          strokeWidth="3.5"
          filter="url(#glow)"
          className="stroke-neon-indigo"
        />

        {/* Hover vertical line tracker */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1="20"
            x2={hoveredPoint.x}
            y2={height - 30}
            stroke="#475569"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        )}

        {/* Hover intersection dot */}
        {hoveredPoint && (
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r="6"
            fill="#8B5CF6"
            stroke="#F8FAFC"
            strokeWidth="2"
            style={{ filter: 'drop-shadow(0px 0px 4px rgba(139, 92, 246, 0.8))' }}
          />
        )}

        {/* Chart Dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="4"
            fill="#1E293B"
            stroke="#6366F1"
            strokeWidth="1.5"
            className="hover:scale-150 transition-transform duration-100"
          />
        ))}

        {/* X-axis date labels */}
        {points.map((p, i) => {
          // Only show labels for 1st, middle, and last points to avoid crowding
          const shouldShow = i === 0 || i === points.length - 1 || (points.length > 2 && i === Math.floor(points.length / 2));
          if (!shouldShow) return null;
          
          return (
            <text
              key={i}
              x={p.x}
              y={height - 10}
              fill="#64748B"
              fontSize="10"
              fontWeight="bold"
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            >
              {formatDate(p.date)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
