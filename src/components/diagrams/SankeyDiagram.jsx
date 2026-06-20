import React, { useState, useMemo } from 'react';
import { formatCurrency, cleanMerchantName } from '../../utils/formatting';
import { useAppContext } from '../../context/AppContext';
import { Download } from 'lucide-react';

const sanitizeId = (str) => (str || '').replace(/[^a-zA-Z0-9_-]/g, '_');

export default function SankeyDiagram({ transactions, onSelectNode, activeFilter }) {
  const { 
    enableCustomSplits,
    resolvedPartnerAName = "Wife",
    resolvedPartnerBName = "Husband",
    resolvedPartnerAEmployer = "Employer A",
    resolvedPartnerBEmployer = "Employer B"
  } = useAppContext() || {};
  const [hoveredNode, setHoveredNode] = useState(null);
  const [hoveredLink, setHoveredLink] = useState(null);

  const downloadPng = () => {
    const svgEl = document.getElementById('sankey-flow-svg');
    if (!svgEl) return;

    const svgWidth = 1200;
    const svgHeight = height;

    const svgXml = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgXml], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = svgWidth;
      canvas.height = svgHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#0B0F19'; // Obsidian 900 dark background
        ctx.fillRect(0, 0, svgWidth, svgHeight);
        ctx.drawImage(img, 0, 0, svgWidth, svgHeight);
        
        const a = document.createElement('a');
        a.download = `finflow-cashflow-sankey-${new Date().toISOString().slice(0, 10)}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
      }
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      const a = document.createElement('a');
      a.download = `finflow-cashflow-sankey-${new Date().toISOString().slice(0, 10)}.svg`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    };
    img.src = url;
  };

  const getMonthKey = (date) => {
    if (!(date instanceof Date) || isNaN(date.getTime())) return 'Invalid Date';
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = monthNames[date.getMonth()];
    const year = String(date.getFullYear()).slice(-2);
    return `${month} '${year}`;
  };

  const filteredTxns = transactions;

  // 2. Compute Nodes and Heights
  const flowData = useMemo(() => {
    const rawIncomeMap = {};
    const incomeTransactionsList = [];
    const groupMap = {};
    const categoryMap = {}; // groupName -> { categoryName: amount }

    let totalExpense = 0;
    
    filteredTxns.forEach(t => {
      const amount = t.amount;
      const catName = t.category || 'Uncategorized';
      const groupName = t.group || 'Other';
      const type = t.type || '';
      
      if (type === 'Income') {
        const catNameLower = catName.toLowerCase();
        let sourceName = (catNameLower.includes('deposit') || catNameLower.includes('paycheck') || catNameLower === 'income')
          ? cleanMerchantName(t.description)
          : catName;

        const sourceLower = sourceName.toLowerCase();
        const partnerALower = resolvedPartnerAName.toLowerCase();
        const partnerBLower = resolvedPartnerBName.toLowerCase();
        const employerALower = resolvedPartnerAEmployer.toLowerCase();
        const employerBLower = resolvedPartnerBEmployer.toLowerCase();

        // Standardize employer/partner mappings to consolidate Todd's (BD/Becton) and Kaitlyn's (Havas) payrolls
        if (
          sourceLower.includes(partnerBLower) || 
          sourceLower.includes(employerBLower) || 
          sourceLower.includes('todd') || 
          sourceLower.includes('becton') || 
          sourceLower.includes('bd')
        ) {
          sourceName = `${resolvedPartnerBName} Payroll`;
        } else if (
          sourceLower.includes(partnerALower) || 
          sourceLower.includes(employerALower) || 
          sourceLower.includes('kaitlyn') || 
          sourceLower.includes('havas')
        ) {
          sourceName = `${resolvedPartnerAName} Payroll`;
        } else if (sourceLower.includes('annuity')) {
          sourceName = 'Annuity';
        } else if (catNameLower.includes('deposit') || catNameLower.includes('paycheck') || catNameLower === 'income') {
          sourceName = sourceName || 'Other Income';
        } else {
          sourceName = catName;
        }

        rawIncomeMap[sourceName] = (rawIncomeMap[sourceName] || 0) + amount;
        incomeTransactionsList.push({ sourceName, amount });
      } else if (type === 'Expense') {
        const absVal = Math.abs(amount);
        
        // Consolidate specific category groups under major parent categories (Living / Discretionary)
        let resolvedGroup = groupName;
        const groupLower = groupName.toLowerCase().trim();
        if (groupLower === 'utilities') {
          resolvedGroup = 'Living';
        } else if (groupLower === 'financial' || groupLower === 'other' || groupLower === 'uncategorized' || groupLower === 'other expense') {
          const catLower = catName.toLowerCase().trim();
          if (catLower.includes('fee') || catLower.includes('interest') || catLower.includes('tax') || catLower.includes('parking') || catLower.includes('gas') || catLower.includes('auto')) {
            resolvedGroup = 'Living';
          } else {
            resolvedGroup = 'Discretionary';
          }
        }

        groupMap[resolvedGroup] = (groupMap[resolvedGroup] || 0) + absVal;
        
        if (!categoryMap[resolvedGroup]) categoryMap[resolvedGroup] = {};
        categoryMap[resolvedGroup][catName] = (categoryMap[resolvedGroup][catName] || 0) + absVal;
        
        totalExpense += absVal;
      } else if (type === 'Transfer' && (groupName === 'Investments' || groupName === 'Cash Savings')) {
        const absVal = Math.abs(amount);
        
        let resolvedGroup = groupName === 'Cash Savings' ? 'Net Savings' : groupName;
        if (groupName === 'Investments') {
          resolvedGroup = 'Investments';
        }

        groupMap[resolvedGroup] = (groupMap[resolvedGroup] || 0) + absVal;
        
        if (!categoryMap[resolvedGroup]) categoryMap[resolvedGroup] = {};
        categoryMap[resolvedGroup][catName] = (categoryMap[resolvedGroup][catName] || 0) + absVal;
        
        totalExpense += absVal;
      }
    });

    // Consolidate income sources: merge minor sources under $500 to "Other Income"
    const incomeMap = {};
    let totalIncome = 0;
    
    incomeTransactionsList.forEach(item => {
      let name = item.sourceName;
      const totalForSource = rawIncomeMap[name] || 0;
      if (
        totalForSource < 500 && 
        name !== `${resolvedPartnerBName} Payroll` && 
        name !== `${resolvedPartnerAName} Payroll` && 
        name !== 'Annuity'
      ) {
        name = 'Other Income';
      }
      incomeMap[name] = (incomeMap[name] || 0) + item.amount;
      totalIncome += item.amount;
    });

    const investmentGroupsSum = (groupMap['Investments'] || 0) + (groupMap['Wealth Building'] || 0);
    const surplusValue = totalIncome - (totalExpense - investmentGroupsSum);
    const totalSavings = Math.max(0, surplusValue);

    return {
      incomeMap,
      groupMap,
      categoryMap,
      totalIncome,
      totalExpense,
      totalSavings
    };
  }, [filteredTxns, enableCustomSplits, resolvedPartnerAName, resolvedPartnerBName, resolvedPartnerAEmployer, resolvedPartnerBEmployer]);

  const { incomeMap, groupMap, categoryMap, totalIncome, totalExpense, totalSavings } = flowData;

  // Dynamically compute counts to scale layout height and prevent text/bottom cutoff
  const sourceCount = Object.keys(incomeMap).length;
  const groupCount = Object.keys(groupMap).length + (totalSavings > 0 ? 1 : 0);
  const categoryCount = Object.values(categoryMap).reduce((sum, cats) => sum + Object.keys(cats).length, 0) + (totalSavings > 0 ? 1 : 0);
  
  const maxNodes = Math.max(sourceCount, groupCount, categoryCount, 8);
  const height = Math.max(540, maxNodes * 32 + 100);

  // Layout configuration
  const width = 1200;
  const nodeWidth = 18;
  const columnGap = 210; // space between columns
  const margin = { top: 30, right: 260, bottom: 30, left: 280 };

  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;

  // Positions of columns
  const col1X = margin.left;
  const col2X = margin.left + columnGap;
  const col3X = margin.left + 2 * columnGap;
  const col4X = margin.left + 3 * columnGap;

  const totalRightSide = totalExpense + (totalSavings > 0 ? totalSavings : 0);
  const maxFlow = Math.max(totalIncome, totalRightSide) || 1;
  
  // Calculate spacing and dynamically clip heightScale to prevent vertical container overflow
  const totalSpacing = (categoryCount - 1) * 8 + (groupCount - 1) * 6;
  const heightScale = Math.min(chartHeight * 0.82, chartHeight - totalSpacing - (categoryCount * 6) - 10);

  // Column 1: Income Sources
  const col1Nodes = useMemo(() => {
    const incomeSources = Object.entries(incomeMap).sort((a, b) => b[1] - a[1]);
    const totalNodesHeight = incomeSources.reduce((sum, [_, val]) => sum + Math.max(8, (val / maxFlow) * heightScale), 0) + (incomeSources.length - 1) * 12;
    let currentY = margin.top + (chartHeight - totalNodesHeight) / 2;
    
    return incomeSources.map(([name, val]) => {
      const nodeHeight = (val / maxFlow) * heightScale;
      const node = {
        id: sanitizeId(`source_${name}`),
        name,
        value: val,
        x: col1X,
        y: currentY,
        h: Math.max(8, nodeHeight),
        type: 'source',
        color: '#10B981'
      };
      currentY += Math.max(8, nodeHeight) + 12;
      return node;
    });
  }, [incomeMap, maxFlow, heightScale, col1X, chartHeight]);

  // Column 2: Total Income Pool
  const col2Node = useMemo(() => {
    const nodeHeight = heightScale;
    const y = margin.top + (chartHeight - nodeHeight) / 2;
    return {
      id: 'pool_income',
      name: 'Total Income',
      value: totalIncome,
      x: col2X,
      y,
      h: nodeHeight,
      type: 'pool',
      color: '#6366F1'
    };
  }, [totalIncome, heightScale, col2X, chartHeight]);

  // Column 3: Groups
  const col3Nodes = useMemo(() => {
    const groupsList = Object.entries(groupMap).sort((a, b) => b[1] - a[1]);
    if (totalSavings > 0) {
      groupsList.push(['Net Savings', totalSavings]);
    }
    
    const totalNodesHeight = groupsList.reduce((sum, [_, val]) => sum + Math.max(8, (val / maxFlow) * heightScale), 0) + (groupsList.length - 1) * 12;
    let currentY = margin.top + (chartHeight - totalNodesHeight) / 2;

    return groupsList.map(([name, val]) => {
      const nodeHeight = (val / maxFlow) * heightScale;
      let color = '#F43F5E'; // rose/pink for expenses
      if (name === 'Net Savings') {
        color = '#10B981'; // green for dynamic surplus / net savings
      } else if (name === 'Cash Savings') {
        color = '#3B82F6'; // blue for cash savings
      } else if (name === 'Investments') {
        color = '#8B5CF6'; // purple for investments
      }
      
      const node = {
        id: sanitizeId(`group_${name}`),
        name,
        value: val,
        x: col3X,
        y: currentY,
        h: Math.max(8, nodeHeight),
        type: 'group',
        color
      };
      currentY += Math.max(8, nodeHeight) + 12;
      return node;
    });
  }, [groupMap, totalSavings, maxFlow, heightScale, col3X, chartHeight]);

  // Column 4: Categories
  const categoryNodesMap = useMemo(() => {
    const map = {};
    col3Nodes.forEach(groupNode => {
      const groupName = groupNode.name;
      if (groupName === 'Net Savings') {
        map[groupName] = [{
          id: 'dest_Net_Savings',
          name: 'Unspent Cash',
          value: groupNode.value,
          color: groupNode.color
        }];
        return;
      }

      const cats = Object.entries(categoryMap[groupName] || {}).sort((a, b) => b[1] - a[1]);
      map[groupName] = cats.map(([catName, val]) => ({
        id: sanitizeId(`dest_${catName}`),
        name: catName,
        value: val,
        color: groupNode.color
      }));
    });
    return map;
  }, [col3Nodes, categoryMap]);

  const col4Nodes = useMemo(() => {
    const nodes = [];
    // Count total categories to center them
    let totalCats = 0;
    let totalHeight = 0;
    
    col3Nodes.forEach(groupNode => {
      const cats = categoryNodesMap[groupNode.name] || [];
      totalCats += cats.length;
      cats.forEach(c => {
        const nodeHeight = (c.value / maxFlow) * heightScale;
        totalHeight += Math.max(6, nodeHeight);
      });
    });

    const totalSpacing = (totalCats - 1) * 8 + (col3Nodes.length - 1) * 6;
    let currentY = margin.top + (chartHeight - (totalHeight + totalSpacing)) / 2;
    if (currentY < margin.top) currentY = margin.top;

    col3Nodes.forEach(groupNode => {
      const cats = categoryNodesMap[groupNode.name] || [];
      cats.forEach(c => {
        const nodeHeight = (c.value / maxFlow) * heightScale;
        nodes.push({
          ...c,
          x: col4X,
          y: currentY,
          h: Math.max(6, nodeHeight),
          type: 'category'
        });
        currentY += Math.max(6, nodeHeight) + 8;
      });
      currentY += 6; // gap between groups
    });

    return nodes;
  }, [col3Nodes, categoryNodesMap, maxFlow, heightScale, col4X, chartHeight]);

  // Compute Ribbons (Links)
  const links = useMemo(() => {
    const results = [];
    if (totalIncome === 0) return [];

    // 1. Column 1 (Sources) -> Column 2 (Total Income Pool)
    const incomingOffset = (col2Node.h - (totalIncome / maxFlow) * heightScale) / 2;
    let poolLeftY = col2Node.y + incomingOffset;
    col1Nodes.forEach(source => {
      const linkH = (source.value / maxFlow) * heightScale;
      results.push({
        id: sanitizeId(`link_${source.id}_to_pool`),
        sourceId: source.id,
        targetId: col2Node.id,
        sourceName: source.name,
        targetName: col2Node.name,
        value: source.value,
        x1: source.x + nodeWidth,
        y1: source.y,
        h1: source.h,
        x2: col2Node.x,
        y2: poolLeftY,
        h2: linkH,
        color: source.color
      });
      poolLeftY += linkH;
    });

    // 2. Column 2 (Total Income Pool) -> Column 3 (Groups)
    let poolRightY = col2Node.y;
    col3Nodes.forEach(group => {
      const linkH = (group.value / maxFlow) * heightScale;
      results.push({
        id: sanitizeId(`link_pool_to_${group.id}`),
        sourceId: col2Node.id,
        targetId: group.id,
        sourceName: col2Node.name,
        targetName: group.name,
        value: group.value,
        x1: col2Node.x + nodeWidth,
        y1: poolRightY,
        h1: linkH,
        x2: group.x,
        y2: group.y,
        h2: group.h,
        color: group.color
      });
      poolRightY += linkH;
    });

    // 3. Column 3 (Groups) -> Column 4 (Categories)
    col3Nodes.forEach(groupNode => {
      const cats = categoryNodesMap[groupNode.name] || [];
      let groupOutletY = groupNode.y;
      
      cats.forEach(c => {
        const targetNode = col4Nodes.find(n => n.id === c.id);
        if (!targetNode) return;
        
        const linkH = (c.value / groupNode.value) * groupNode.h;
        results.push({
          id: sanitizeId(`link_${groupNode.id}_to_${targetNode.id}`),
          sourceId: groupNode.id,
          targetId: targetNode.id,
          sourceName: groupNode.name,
          targetName: targetNode.name,
          value: c.value,
          x1: groupNode.x + nodeWidth,
          y1: groupOutletY,
          h1: linkH,
          x2: targetNode.x,
          y2: targetNode.y,
          h2: targetNode.h,
          color: groupNode.color
        });
        groupOutletY += linkH;
      });
    });

    return results;
  }, [col1Nodes, col2Node, col3Nodes, col4Nodes, categoryNodesMap, totalIncome]);

  const drawRibbon = (link) => {
    const { x1, y1, h1, x2, y2, h2 } = link;
    const cpX = (x1 + x2) / 2;
    return `
      M ${x1} ${y1}
      C ${cpX} ${y1}, ${cpX} ${y2}, ${x2} ${y2}
      L ${x2} ${y2 + h2}
      C ${cpX} ${y2 + h2}, ${cpX} ${y1 + h1}, ${x1} ${y1 + h1}
      Z
    `;
  };

  const allNodes = [...col1Nodes, col2Node, ...col3Nodes, ...col4Nodes];
  const investmentGroupsSum = (groupMap['Investments'] || 0) + (groupMap['Wealth Building'] || 0);
  const surplusValue = totalIncome - (totalExpense - investmentGroupsSum);
  const surplusRate = totalIncome > 0 ? (surplusValue / totalIncome) * 100 : 0;

  return (
    <div className="bg-obsidian-800/40 border border-obsidian-700/60 rounded-3xl p-6 shadow-xl overflow-hidden relative">
      {/* Dynamic Surplus Header Panel */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 border-b border-obsidian-750 pb-5">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Sankey Flow Analysis</span>
          <div className="flex items-baseline space-x-2 mt-1">
            <h4 className="text-sm font-semibold text-slate-350">Dynamic Surplus:</h4>
            <span className={`text-xl font-black font-display ${surplusValue >= 0 ? 'text-neon-emerald' : 'text-neon-crimson'}`}>
              {formatCurrency(surplusValue)}
            </span>
            <span className="text-xs font-bold text-slate-500">
              (Savings Rate: {surplusRate.toFixed(1)}%)
            </span>
            {activeFilter && (
              <button 
                onClick={() => onSelectNode && onSelectNode(null, null)}
                className="ml-4 text-[10px] font-black uppercase text-neon-indigo hover:text-white bg-neon-indigo/15 border border-neon-indigo/30 px-2 py-0.5 rounded-full transition-all"
              >
                Clear Filter: {activeFilter.name || 'Link'} ✕
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center space-x-6 text-xs text-slate-400">
          <div>
            <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total Inflow</span>
            <span className="text-white font-bold text-sm">{formatCurrency(totalIncome)}</span>
          </div>
          <div>
            <span className="block text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total Outflow</span>
            <span className="text-white font-bold text-sm">{formatCurrency(totalExpense)}</span>
          </div>
          <button 
            onClick={downloadPng}
            title="Download Flow Diagram"
            className="flex items-center justify-center p-2 rounded-xl bg-obsidian-750 hover:bg-obsidian-700 text-slate-400 hover:text-white transition-all border border-obsidian-700 cursor-pointer shrink-0"
          >
            <Download size={16} />
          </button>
        </div>
      </div>

      <div className="w-full overflow-x-auto hide-scrollbar">
        <div className="min-w-[1050px] relative">
          <svg id="sankey-flow-svg" viewBox={`0 0 ${width} ${height}`} className="w-full h-auto select-none">
            <defs>
              {/* Gradients for ribbons */}
              {links.map(l => (
                <linearGradient key={`grad_${l.id}`} id={`grad_${l.id}`} x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor={l.color} stopOpacity="0.4" />
                  <stop offset="100%" stopColor={l.color} stopOpacity="0.1" />
                </linearGradient>
              ))}
            </defs>


            {/* Render Link Ribbons */}
            <g>
              {links.map((link) => {
                const isActiveFilter = activeFilter && activeFilter.type === 'link' && 
                                       activeFilter.source === link.sourceName && 
                                       activeFilter.target === link.targetName;
                const isHovered = hoveredLink === link.id || 
                                  (hoveredNode && (link.sourceId === hoveredNode || link.targetId === hoveredNode)) ||
                                  isActiveFilter;
                
                return (
                  <path
                    key={link.id}
                    d={drawRibbon(link)}
                    fill={`url(#grad_${link.id})`}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredLink(link.id)}
                    onMouseLeave={() => setHoveredLink(null)}
                    onClick={() => onSelectNode && onSelectNode('link', { source: link.sourceName, target: link.targetName })}
                    style={{
                      opacity: isHovered ? 0.95 : hoveredNode || hoveredLink || activeFilter ? 0.12 : 0.55,
                    }}
                  />
                );
              })}
            </g>

            {/* Render Column Nodes */}
            <g>
              {allNodes.map((node) => {
                const isHovered = hoveredNode === node.id;
                const isLinked = hoveredLink && (
                  links.find(l => l.id === hoveredLink)?.sourceId === node.id ||
                  links.find(l => l.id === hoveredLink)?.targetId === node.id
                );
                const isActiveFilter = activeFilter && activeFilter.name === node.name && activeFilter.type === node.type;
                const highlight = isHovered || isLinked || isActiveFilter;

                return (
                  <g 
                    key={node.id} 
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    onClick={() => onSelectNode && onSelectNode(node.type, node.name)}
                  >
                    {/* Node bar */}
                    <rect
                      x={node.x}
                      y={node.y}
                      width={nodeWidth}
                      height={node.h}
                      fill={node.color}
                      rx="3"
                      style={{
                        filter: highlight ? `drop-shadow(0px 0px 5px ${node.color})` : 'none',
                        opacity: highlight || (!hoveredNode && !hoveredLink && !activeFilter) ? 1 : 0.45,
                        stroke: isActiveFilter ? 'var(--text-primary)' : 'none',
                        strokeWidth: isActiveFilter ? 1.5 : 0
                      }}
                      className="transition-all duration-200"
                    />

                    {/* Node Label text */}
                    <text
                      x={node.type === 'source' ? node.x - 10 : node.x + nodeWidth + 10}
                      y={node.y + node.h / 2 + 4}
                      fill={highlight ? 'var(--text-primary)' : 'var(--text-secondary)'}
                      fontSize="10"
                      fontWeight={highlight ? 'bold' : 'semibold'}
                      textAnchor={node.type === 'source' ? 'end' : 'start'}
                      className="transition-colors duration-200 select-none"
                    >
                      {node.name} ({formatCurrency(node.value)})
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>
      
      {/* Visual Indicator of Empty States */}
      {totalIncome === 0 && (
        <div className="absolute inset-0 bg-obsidian-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-center p-6">
          <p className="text-slate-400 font-bold text-lg">No flow data for this period</p>
          <p className="text-slate-500 text-sm mt-1">Try switching to a month with recorded transactions.</p>
        </div>
      )}
    </div>
  );
}
