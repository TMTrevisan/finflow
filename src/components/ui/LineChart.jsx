import React, { useState, useRef, useMemo } from 'react';
import { formatCurrency, formatDate } from '../../utils/formatting';

export default function LineChart({ 
  data, 
  height = 240,
  lineColor = '#6366F1',
  glowColor = '#6366F1',
  gradientColor = '#6366F1',
  fillOpacity = 0.2,
  strokeWidth = 3,
  showGrid = false
}) {
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
      <div className="flex items-center justify-center bg-obsidian-800/10 rounded-2xl border border-obsidian-800/40" style={{ height }}>
        <p className="text-slate-500 text-sm font-semibold">No data available</p>
      </div>
    );
  }

  // Unique ID for gradient/glow so multiple charts don't conflict
  const chartId = useMemo(() => Math.random().toString(36).substr(2, 9), []);

  return (
    <div className="relative w-full">
      {/* Tooltip Hover Overlay */}
      {hoveredPoint && (
        <div 
          className="absolute z-10 bg-black/95 backdrop-blur border border-slate-800 rounded-2xl p-3 shadow-2xl pointer-events-none transition-all duration-150"
          style={{
            left: `${((hoveredPoint.x - 30) / 800) * 100}%`,
            top: `${Math.max(10, hoveredPoint.y - 100)}px`,
            transform: 'translateX(-50%)'
          }}
        >
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-1">
            {hoveredPoint.date}
          </div>
          <div className="text-base font-bold text-white mb-0.5">
            {formatCurrency(hoveredPoint.value)}
          </div>
          {hoveredPoint.assets !== undefined && hoveredPoint.liabilities !== undefined && (
            <div className="flex space-x-3 text-[10px] text-slate-400">
              <span>Assets: <span className="text-neon-emerald font-semibold">{formatCurrency(hoveredPoint.assets)}</span></span>
              <span>Debts: <span className="text-neon-crimson font-semibold">{formatCurrency(hoveredPoint.liabilities)}</span></span>
            </div>
          )}
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
          <filter id={`glow-${chartId}`} x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor={glowColor} floodOpacity="0.35" />
          </filter>
          
          {/* Fill gradient under line */}
          <linearGradient id={`areaGrad-${chartId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradientColor} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={gradientColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal gridlines */}
        {showGrid && [0, 0.25, 0.5, 0.75, 1].map((r, i) => {
          const y = 20 + r * (height - 50);
          return (
            <line
              key={i}
              x1="30"
              y1={y}
              x2="770"
              y2={y}
              stroke="#121826"
              strokeDasharray="4 4"
              strokeWidth="1"
            />
          );
        })}

        {/* Shaded Area under the line */}
        <path d={areaD} fill={`url(#areaGrad-${chartId})`} />

        {/* Smooth Curved Line */}
        <path
          d={pathD}
          fill="none"
          stroke={lineColor}
          strokeWidth={strokeWidth}
          filter={`url(#glow-${chartId})`}
        />

        {/* Hover vertical line tracker */}
        {hoveredPoint && (
          <line
            x1={hoveredPoint.x}
            y1="20"
            x2={hoveredPoint.x}
            y2={height - 30}
            stroke="#1E293B"
            strokeWidth="1.5"
            strokeDasharray="2 2"
          />
        )}

        {/* Hover intersection dot */}
        {hoveredPoint && (
          <circle
            cx={hoveredPoint.x}
            cy={hoveredPoint.y}
            r="5"
            fill={lineColor}
            stroke="#FFFFFF"
            strokeWidth="2"
          />
        )}

        {/* Chart Dots - only display on hover to keep trend ultra clean */}
        {!hoveredPoint && points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="3"
            fill="#090D14"
            stroke={lineColor}
            strokeWidth="2"
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
              y={height - 8}
              fill="#475569"
              fontSize="9"
              fontWeight="600"
              textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"}
            >
              {p.date}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
