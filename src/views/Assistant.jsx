import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { safeStorage } from '../utils/storage';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { cleanMerchantName } from '../utils/formatting';
import AssistantHeader from '../components/assistant/AssistantHeader';
import MessageFeed from '../components/assistant/MessageFeed';
import PrivacyControls from '../components/assistant/PrivacyControls';
import ChatInput from '../components/assistant/ChatInput';
import OnboardingKeyScreen from '../components/assistant/OnboardingKeyScreen';
import SharedContextDrawer from '../components/assistant/SharedContextDrawer';

const normalizeAiModel = (provider, model) => (
  provider === 'deepseek' && !['deepseek-v4-flash', 'deepseek-v4-pro'].includes(model)
    ? 'deepseek-v4-flash'
    : model
);

export default function Assistant() {
  const { transactions = [], categories = [], balances = [], logSync = () => {} } = useAppContext();

  // Fiduciary Planner Mode
  const [fiduciaryMode, setFiduciaryMode] = useState(() => safeStorage.getItem('finflow_fiduciary_mode') === 'true');

  const handleToggleFiduciaryMode = (enabled) => {
    setFiduciaryMode(enabled);
    safeStorage.setItem('finflow_fiduciary_mode', enabled ? 'true' : 'false');
  };

  const triggerFiduciaryAudit = () => {
    const auditPrompt = `Perform a comprehensive Fiduciary Financial Audit. Analyze my current Net Worth, Cash reserves, Invested portfolios, Budgets, and spending categories. Provide objective, fiduciary-grade recommendations strictly in my best interest, including:
1. Fee optimization (identify high-fee structures/mutual funds vs. low-cost index funds).
2. Liquidity & Cash Drag optimization (is cash sweep optimal, too high, or too low?).
3. Emergency fund size vs. burn rate.
4. Tax-efficient asset location.
5. Highlight any anomalies or recurring waste.`;
    handleSendMessage(auditPrompt);
  };

  // Unified Config States
  const [aiProvider, setAiProvider] = useState(() => safeStorage.getItem('finflow_ai_provider') || 'gemini');
  const [aiModel, setAiModel] = useState(() => normalizeAiModel(
    safeStorage.getItem('finflow_ai_provider') || 'gemini',
    safeStorage.getItem('finflow_ai_model') || 'gemini-2.5-flash-lite'
  ));
  
  // API Keys
  const [geminiKey, setGeminiKey] = useState(() => safeStorage.getItem('finflow_gemini_key') || '');
  const [openaiKey, setOpenaiKey] = useState(() => safeStorage.getItem('finflow_openai_key') || '');
  const [claudeKey, setClaudeKey] = useState(() => safeStorage.getItem('finflow_claude_key') || '');
  const [deepseekKey, setDeepseekKey] = useState(() => safeStorage.getItem('finflow_deepseek_key') || '');

  // Dynamic Key input for onboarding
  const [onboardingKeyInput, setOnboardingKeyInput] = useState('');

  // MCP integration
  const [mcpEnabled, setMcpEnabled] = useState(() => safeStorage.getItem('finflow_mcp_enabled') === 'true');
  const [mcpUrl, setMcpUrl] = useState(() => {
    const raw = safeStorage.getItem('finflow_mcp_url') || 'http://localhost:3001';
    return raw.trim().replace(/\/+$/, '');
  });
  const [mcpSecret, setMcpSecret] = useState(() => safeStorage.getItem('finflow_mcp_secret') || 'test123');
  const [mcpTools, setMcpTools] = useState([]);
  const [mcpStatus, setMcpStatus] = useState('idle');
  const [toolStatus, setToolStatus] = useState('');
  const activeAbortControllerRef = useRef(null);

  const [showSharedContext, setShowSharedContext] = useState(false);
  const [redactSensitiveData, setRedactSensitiveData] = useState(() => safeStorage.getItem('finflow_ai_redact') === 'true');
  const [aggregateOnlyMode, setAggregateOnlyMode] = useState(() => safeStorage.getItem('finflow_ai_aggregate_only') === 'true');

  const [chatLog, setChatLog] = useState(() => {
    const saved = safeStorage.getItem('finflow_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.warn('[Assistant] Failed to parse saved chat history:', e);
      }
    }
    return [
      {
        role: 'model',
        content: "Hello! I'm your upgraded FinFlow Copilot. I have access to your account balances, budgets, and transaction history. Ask me anything!"
      }
    ];
  });

  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const chatEndRef = useRef(null);

  // Save chat log history
  useEffect(() => {
    safeStorage.setItem('finflow_chat_history', JSON.stringify(chatLog));
  }, [chatLog]);

  // Active Key resolver
  const activeApiKey = useMemo(() => {
    switch (aiProvider) {
      case 'openai': return openaiKey;
      case 'claude': return claudeKey;
      case 'deepseek': return deepseekKey;
      case 'gemini':
      default:
        return geminiKey;
    }
  }, [aiProvider, geminiKey, openaiKey, claudeKey, deepseekKey]);

  // Sync state with settings change
  useEffect(() => {
    const handleStorageChange = () => {
      setAiProvider(safeStorage.getItem('finflow_ai_provider') || 'gemini');
      setAiModel(normalizeAiModel(
        safeStorage.getItem('finflow_ai_provider') || 'gemini',
        safeStorage.getItem('finflow_ai_model') || 'gemini-2.5-flash-lite'
      ));
      setGeminiKey(safeStorage.getItem('finflow_gemini_key') || '');
      setOpenaiKey(safeStorage.getItem('finflow_openai_key') || '');
      setClaudeKey(safeStorage.getItem('finflow_claude_key') || '');
      setDeepseekKey(safeStorage.getItem('finflow_deepseek_key') || '');
      setMcpEnabled(safeStorage.getItem('finflow_mcp_enabled') === 'true');
      const rawUrl = safeStorage.getItem('finflow_mcp_url') || 'http://localhost:3001';
      setMcpUrl(rawUrl.trim().replace(/\/+$/, ''));
      setMcpSecret(safeStorage.getItem('finflow_mcp_secret') || 'test123');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Fetch MCP tools if enabled with Render cold-start retry protection
  useEffect(() => {
    let active = true;
    let timeoutId;
    let sleepingTimeoutId;
    let retryTimeoutId;
    let retryCount = 0;

    const getTools = async () => {
      if (!mcpEnabled || !mcpUrl) {
        if (active) setMcpStatus('idle');
        setMcpTools([]);
        return;
      }
      if (active) setMcpStatus('connecting');
      
      const controller = new AbortController();
      // Keep connection alive for 50 seconds to let Render spin up completely
      timeoutId = setTimeout(() => {
        controller.abort();
        if (active) setMcpStatus('offline');
      }, 50000);

      // Flag as 'sleeping' visually after 5 seconds, but DO NOT cancel the fetch request!
      sleepingTimeoutId = setTimeout(() => {
        if (active) setMcpStatus('sleeping');
      }, 5000);

      const requestUrl = mcpSecret 
        ? (mcpUrl.endsWith(mcpSecret) ? `${mcpUrl}/tools` : `${mcpUrl}/${mcpSecret}/tools`)
        : `${mcpUrl}/tools`;

      try {
        const response = await fetch(requestUrl, {
          signal: controller.signal,
          headers: mcpSecret ? { 'Authorization': `Bearer ${mcpSecret}` } : {}
        });
        clearTimeout(timeoutId);
        clearTimeout(sleepingTimeoutId);
        
        if (!active) return;
        if (response.ok) {
          const data = await response.json();
          setMcpTools(data.tools || []);
          setMcpStatus('online');
        } else {
          setMcpTools([]);
          setMcpStatus('offline');
        }
      } catch (err) {
        clearTimeout(timeoutId);
        clearTimeout(sleepingTimeoutId);
        if (!active) return;
        
        if (err.name === 'AbortError' || err.message?.includes('Failed to fetch') || err.message?.includes('Load failed')) {
          // If connection timed out/failed, it might be cold-starting on Render
          if (retryCount < 3) {
            retryCount++;
            if (active) setMcpStatus('sleeping');
            retryTimeoutId = setTimeout(getTools, 6000); // Retry in 6 seconds
          } else {
            setMcpTools([]);
            if (active) setMcpStatus('offline');
          }
        } else {
          setMcpTools([]);
          if (active) setMcpStatus('offline');
        }
        console.warn('[MCP] Failed to fetch server tools:', err.message);
      }
    };

    getTools();

    return () => {
      active = false;
      clearTimeout(timeoutId);
      clearTimeout(sleepingTimeoutId);
      clearTimeout(retryTimeoutId);
    };
  }, [mcpEnabled, mcpUrl, mcpSecret]);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isGenerating, toolStatus]);

  const handleToggleRedact = (val) => {
    setRedactSensitiveData(val);
    safeStorage.setItem('finflow_ai_redact', val ? 'true' : 'false');
  };

  const handleToggleAggregateOnly = (val) => {
    setAggregateOnlyMode(val);
    safeStorage.setItem('finflow_ai_aggregate_only', val ? 'true' : 'false');
  };

  // Onboarding key saver
  const handleSaveOnboardingKey = () => {
    if (onboardingKeyInput.trim()) {
      const storageKey = `finflow_${aiProvider}_key`;
      safeStorage.setItem(storageKey, onboardingKeyInput.trim());
      if (aiProvider === 'gemini') setGeminiKey(onboardingKeyInput.trim());
      else if (aiProvider === 'openai') setOpenaiKey(onboardingKeyInput.trim());
      else if (aiProvider === 'claude') setClaudeKey(onboardingKeyInput.trim());
      else if (aiProvider === 'deepseek') setDeepseekKey(onboardingKeyInput.trim());
      setOnboardingKeyInput('');
      setErrorMessage('');
    }
  };

  const SUGGESTIONS = [
    "Am I on track to save money this month?",
    "How does my grocery spend this month compare to my average?",
    "What are my top 3 largest transactions in the last 30 days?",
    "Which of my categories is closest to exceeding its budget limit?",
    "Analyze my recurring subscription costs.",
    "Do you see any unusual transactions or anomalies recently?"
  ];

  const FIDUCIARY_SUGGESTIONS = [
    "Run Fiduciary Financial Audit on my current net worth and holdings.",
    "Analyze my portfolio holdings and recommend low-cost ETF fee optimizations.",
    "Check my liquidity allocation and cash sweep drag costs.",
    "Evaluate my emergency fund adequacy and savings yield.",
    "Create a tax-efficient asset location strategy for my accounts.",
    "Audit my recurring subscriptions and transaction history for hidden waste."
  ];

  const activeSuggestions = fiduciaryMode ? FIDUCIARY_SUGGESTIONS : SUGGESTIONS;

  // Helper to compile structured financial context
  const financialContext = useMemo(() => {
    const latestMap = new Map();
    const sortedBalances = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sortedBalances.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMap.set(key, b);
    });
    const latestBalances = Array.from(latestMap.values());

    const accountsData = aggregateOnlyMode ? [] : latestBalances.map((b, idx) => ({
      inst: redactSensitiveData ? `Institution ${idx + 1}` : b.institution,
      name: redactSensitiveData ? `${b.class} Account ${idx + 1}` : b.account,
      bal: b.balance,
      cls: b.class,
      typ: b.type
    }));

    let cashTotal = 0;
    let investTotal = 0;
    let creditTotal = 0;
    let loanTotal = 0;

    latestBalances.forEach(b => {
      const val = Number(b.balance) || 0;
      const typeLower = (b.type || '').toLowerCase();
      const nameLower = (b.account || '').toLowerCase();
      const instLower = (b.institution || '').toLowerCase();

      if (b.class === 'Asset') {
        const isInvest = typeLower.includes('investment') ||
          typeLower.includes('brokerage') ||
          typeLower.includes('retirement') ||
          typeLower.includes('401') ||
          typeLower.includes('ira') ||
          typeLower.includes('529') ||
          nameLower.includes('fidelity') ||
          nameLower.includes('etrade') ||
          nameLower.includes('schwab') ||
          nameLower.includes('vanguard') ||
          nameLower.includes('robinhood') ||
          instLower.includes('fidelity') ||
          instLower.includes('etrade') ||
          instLower.includes('schwab');

        if (isInvest) investTotal += val;
        else cashTotal += val;
      } else if (b.class === 'Liability') {
        const isCard = typeLower.includes('credit') || nameLower.includes('card');
        if (isCard) creditTotal += val;
        else loanTotal += val;
      }
    });

    const latestDate = transactions.length > 0 ? new Date(Math.max(...transactions.map(t => new Date(t.date).getTime()))) : new Date();
    const currentMonth = latestDate.getUTCMonth();
    const currentYear = latestDate.getUTCFullYear();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const activeMonthLabel = `${monthNames[currentMonth]} ${currentYear}`;

    let currentMonthIncome = 0;
    let currentMonthExpenses = 0;

    transactions.forEach(t => {
      if (!t.date) return;
      const d = new Date(t.date);
      if (d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear) {
        const val = Number(t.amount) || 0;
        if (t.type === 'Income') currentMonthIncome += val;
        else if (t.type === 'Expense') currentMonthExpenses += Math.abs(val);
      }
    });

    const budgetData = categories.map(c => {
      const actualSpend = transactions
        .filter(t => 
          t.category?.toLowerCase() === c.category?.toLowerCase() && 
          t.type === 'Expense' &&
          (() => {
            if (!t.date) return false;
            const d = new Date(t.date);
            return d.getUTCMonth() === currentMonth && d.getUTCFullYear() === currentYear;
          })()
        )
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        cat: redactSensitiveData ? `Category ${c.category ? c.category.slice(0, 3) : ''}` : c.category,
        grp: redactSensitiveData ? 'Group' : c.group,
        typ: c.type,
        lim: c.budget,
        spent: actualSpend
      };
    }).filter(b => b.lim > 0 || b.spent > 0);

    const sortedTxns = aggregateOnlyMode ? [] : [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 50)
      .map((t, idx) => ({
        d: t.date,
        m: redactSensitiveData ? `${t.type} txn #${idx + 1}` : cleanMerchantName(t.description),
        c: redactSensitiveData ? `Category` : t.category,
        a: t.amount,
        t: t.type,
        ac: redactSensitiveData ? `Account` : t.account
      }));

    return {
      net: {
        cash: cashTotal,
        debt: creditTotal,
        inv: investTotal,
        loan: loanTotal,
        nw: (cashTotal + investTotal) - (Math.abs(creditTotal) + Math.abs(loanTotal))
      },
      currentMonth: {
        label: activeMonthLabel,
        income: currentMonthIncome,
        expenses: currentMonthExpenses,
        netSurplus: currentMonthIncome - currentMonthExpenses
      },
      accts: accountsData,
      budgets: budgetData,
      txns: sortedTxns
    };
  }, [transactions, categories, balances, redactSensitiveData, aggregateOnlyMode]);

  // Execute local tool on MCP server
  const runMcpTool = async (name, args) => {
    setToolStatus(`Executing tool ${name}...`);
    const requestUrl = mcpSecret 
      ? (mcpUrl.endsWith(mcpSecret) ? `${mcpUrl}/tools/${name}` : `${mcpUrl}/${mcpSecret}/tools/${name}`)
      : `${mcpUrl}/tools/${name}`;

    try {
      const response = await fetch(requestUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(mcpSecret ? { 'Authorization': `Bearer ${mcpSecret}` } : {})
        },
        body: JSON.stringify(args)
      });
      if (!response.ok) {
        throw new Error(`MCP tool invocation failed with status ${response.status}`);
      }
      const data = await response.json();
      return data.result;
    } catch (err) {
      console.error(`[MCP] Tool run error:`, err);
      return { error: err.message };
    } finally {
      setToolStatus('');
    }
  };

  const handleSendMessage = async (textToSend) => {
    const promptText = textToSend || userInput;
    if (!promptText.trim() || isGenerating) return;

    setUserInput('');
    setErrorMessage('');
    setIsGenerating(true);
    logSync(`Copilot: Processing prompt "${promptText.substring(0, 60)}${promptText.length > 60 ? '...' : ''}"`, 'info');

    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
    }
    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    const updatedChat = [...chatLog, { role: 'user', content: promptText }];
    setChatLog(updatedChat);

    const systemPrompt = `${fiduciaryMode ? `LEGALLY & ETHICALLY BOUND FIDUCIARY ADVISOR & PLANNER CONSTRAINTS:
You are acting as a legally and ethically bound Fiduciary Financial Advisor & Wealth Planner. You must act strictly and solely in the client's best interest.
- Minimize investment fees: suggest low-cost broad index ETFs/funds (e.g. VTI, VXUS, BND, SGOV) over high-expense active funds.
- Optimize cash drag: calculate cash drag ratio, suggest moving cash sweeps above 8% to high-yield or invested vehicles.
- Prioritize liquidity and emergency fund: ensure 3-6 months expenses.
- Suggest tax-efficient asset location (bonds in tax-deferred like IRA/401k, equities/index funds in taxable).
- Audit recurring subscriptions and transactions to locate waste.
- Avoid recommending speculative assets (crypto, options, single-stock picking) unless explicitly requested.
- Maintain professional, objective, and analytical tone. Always put the user's wealth preservation and low-cost growth first.` : ''}

You are FinFlow Copilot, an elite personal financial AI assistant.
You have access to the user's local financial database.
${mcpEnabled ? `You have live access to the local database via MCP tools.
IMPORTANT: Do not guess or say you don't have access to historical data. If the user asks for historical data, trends, or complex summaries, call the appropriate MCP tool dynamically!

AVAILABLE MCP TOOLS:
1. "get_summary" -> Fetch current net worth, total assets, total liabilities, and monthly budget summary.
2. "get_transactions" -> Fetch transaction history. Options: { account, category, type ("Income" | "Expense" | "Transfer"), since_date (YYYY-MM-DD), until_date (YYYY-MM-DD), limit }.
3. "get_budgets" -> Fetch budget categories, limits, spending, and remaining. Options: { group, over_budget_only }.
4. "get_accounts" -> Fetch active accounts and balances. Options: { type, class ("Asset" | "Liability") }.
5. "get_portfolio_allocation" -> Breakdown investments by asset class, sector, geography. Options: { account }.
6. "get_net_worth_history" -> Fetch net worth logs. Options: { days, interval ("daily" | "weekly" | "monthly") }.
7. "analyze_spending_trends" -> Detailed MoM/YoY category trends and top merchants. Options: { period ("last_3_months" | "last_6_months" | "this_year" | "last_year"), category }.
8. "get_cash_flow_projection" -> Income vs expenses forecast. Options: { months }.
9. "search_transactions" -> Fuzzy text search on description/category. Options: { query, min_amount, month }.

Use these tools to confidently answer questions like "list grocery totals for each month in the last year" by invoking analyze_spending_trends or get_transactions with dates.` : ''}

<DatabaseContext>
${JSON.stringify(financialContext)}
</DatabaseContext>

Key Context Mappings:
- net: Net worth summary (nw: Net Worth, cash: Total Cash, debt: Credit Card Debt, inv: Investments, loan: Loans).
- currentMonth: Calculated totals for the active month (label: Month Name, income: Total Earned, expenses: Total Spent, netSurplus: Earned minus Spent).
- accts: Active accounts.
- budgets: Category Budgets (cat: Category Name, grp: Group, typ: Type, lim: Budget Limit, spent: Actual Spent).
- txns: Recent Transactions.

Rules:
1. Always prioritize exact figures from the context or tool outputs. Do not invent balances or categories.
2. Format currency nicely using standard dollar signs (e.g. $125.40).
3. Keep responses highly glanceable and direct. Use markdown tables, bold highlights, and bullet points.
4. If a user asks about historical trends outside the provided data, specify that your visibility is currently set to recent syncs or invoke get_net_worth_history / analyze_spending_trends tools.
5. Answer questions with actionable analysis. Compare the user's current month metrics.
6. CRITICAL: At the very end of your response, always propose 2-3 context-appropriate follow-up questions the user might want to ask next. Format these suggestions exactly like: <suggestions>Question 1|Question 2|Question 3</suggestions>`;

    try {
      // Loop for potential tool calling agent flow
      let activeHistory = [...updatedChat];
      let finalResponseGenerated = false;
      let toolCallAttempts = 0;

      while (!finalResponseGenerated && toolCallAttempts < 5) {
        if (aiProvider === 'gemini') {
          // GEMINI DIRECT PIPELINE
          const genAI = new GoogleGenerativeAI(activeApiKey);
          
          // Configure Gemini tools
          const geminiTools = mcpEnabled && mcpTools.length > 0 
            ? [{
                functionDeclarations: mcpTools.map(t => ({
                  name: t.name,
                  description: t.description,
                  parameters: t.inputSchema
                }))
              }]
            : undefined;

          const model = genAI.getGenerativeModel({ 
            model: aiModel,
            systemInstruction: systemPrompt,
            tools: geminiTools
          }, { signal: abortController.signal });

          // Convert history format to Gemini parts
          const contents = activeHistory.map(m => {
            if (m.role === 'tool') {
              return {
                role: 'user',
                parts: [{
                  functionResponse: {
                    name: m.name,
                    response: { result: m.content }
                  }
                }]
              };
            }
            if (m.tool_calls) {
              return {
                role: 'model',
                parts: m.tool_calls.map(tc => ({
                  functionCall: {
                    name: tc.name,
                    args: tc.args
                  }
                }))
              };
            }
            return {
              role: m.role === 'model' ? 'model' : 'user',
              parts: [{ text: m.content }]
            };
          });

          if (mcpEnabled && mcpTools.length > 0) {
            // Non-stream block for tool calling loops
            const result = await model.generateContent({ contents });
            const response = result.response;
            const functionCalls = response.functionCalls;
            let inlineFuncCall = null;
            
            // Check for raw inline text function calls (e.g. <function_call>name(...)
            const textResponse = response.text ? response.text() : '';
            const inlineMatch = textResponse.match(/<function_call>(\w+)\(([\s\S]*?)\)<\/function_call>/);
            if (inlineMatch) {
              try {
                const name = inlineMatch[1];
                const args = JSON.parse(inlineMatch[2].trim());
                inlineFuncCall = { id: name, name, args };
              } catch (e) {}
            }

            if (functionCalls && functionCalls.length > 0) {
              toolCallAttempts++;
              const toolCalls = functionCalls.map(fc => ({
                id: fc.name, // Gemini function call ID is mapped to its name
                name: fc.name,
                args: fc.args
              }));

              // Log tool invocation in feed
              setChatLog(prev => [...prev, {
                role: 'model',
                content: `🔧 *System: Executing ${toolCalls.length} tool(s)...*`
              }]);
              logSync(`Copilot: Invoking ${toolCalls.length} tools via Gemini`, 'info', toolCalls.map(tc => tc.name).join(', '));

              // Run all tool calls
              const toolResponses = [];
              for (const tc of toolCalls) {
                logSync(`Copilot: Executing tool "${tc.name}"`, 'info', JSON.stringify(tc.args));
                const toolResult = await runMcpTool(tc.name, tc.args);
                logSync(`Copilot: Tool "${tc.name}" completed`, 'success');
                toolResponses.push({
                  role: 'tool',
                  tool_call_id: tc.id,
                  name: tc.name,
                  content: JSON.stringify(toolResult)
                });
              }
              
              // Remove system execution message and record in history
              setChatLog(prev => prev.slice(0, -1));
              activeHistory.push({ role: 'model', tool_calls: toolCalls });
              activeHistory.push(...toolResponses);
            } else if (inlineFuncCall) {
              toolCallAttempts++;
              setChatLog(prev => [...prev, {
                role: 'model',
                content: `🔧 *System: Executing local tool ${inlineFuncCall.name}...*`
              }]);
              logSync(`Copilot: Invoking local tool ${inlineFuncCall.name}`, 'info', JSON.stringify(inlineFuncCall.args));
              const toolResult = await runMcpTool(inlineFuncCall.name, inlineFuncCall.args);
              logSync(`Copilot: Tool "${inlineFuncCall.name}" completed`, 'success');
              setChatLog(prev => prev.slice(0, -1));
              activeHistory.push({ role: 'model', tool_calls: [inlineFuncCall] });
              activeHistory.push({
                role: 'tool',
                tool_call_id: inlineFuncCall.id,
                name: inlineFuncCall.name,
                content: JSON.stringify(toolResult)
              });
            } else {
              const text = response.text();
              logSync(`Copilot: Gemini generated text response (${text.length} chars)`, 'success');
              setChatLog(prev => [...prev, { role: 'model', content: text }]);
              finalResponseGenerated = true;
            }
          } else {
            // Direct streaming if no tools
            const result = await model.generateContentStream({ contents });
            setChatLog(prev => [...prev, { role: 'model', content: '' }]);
            
            let accumulatedText = '';
            for await (const chunk of result.stream) {
              accumulatedText += chunk.text();
              setChatLog(prev => {
                const next = [...prev];
                next[next.length - 1] = { role: 'model', content: accumulatedText };
                return next;
              });
            }
            logSync(`Copilot: Gemini generated text response (${accumulatedText.length} chars)`, 'success');
            finalResponseGenerated = true;
          }
        } else {
          // EXTERNAL PROVIDERS (OpenAI, Claude, DeepSeek) - STREAMING & TOOL LOOP VIA LOCAL PROXY
          let fetchUrl = "";
          let fetchHeaders = { "Content-Type": "application/json" };
          let fetchBody = {};

          if (aiProvider === 'openai') {
            fetchUrl = "https://api.openai.com/v1/chat/completions";
            fetchHeaders["Authorization"] = `Bearer ${activeApiKey}`;
            
            const openaiTools = mcpEnabled && mcpTools.length > 0
              ? mcpTools.map(t => ({
                  type: "function",
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema
                  }
                }))
              : undefined;

            // Map history to OpenAI format
            const openaiMessages = [
              { role: "system", content: systemPrompt },
              ...activeHistory.map(m => {
                if (m.role === 'tool') {
                  return { role: "tool", tool_call_id: m.tool_call_id, name: m.name, content: m.content };
                }
                if (m.tool_calls) {
                  return {
                    role: "assistant",
                    tool_calls: m.tool_calls.map(tc => ({
                      id: tc.id,
                      type: "function",
                      function: { name: tc.name, arguments: JSON.stringify(tc.args) }
                    }))
                  };
                }
                return { role: m.role === 'model' ? 'assistant' : 'user', content: m.content };
              })
            ];

            fetchBody = {
              model: normalizeAiModel(aiProvider, aiModel),
              messages: openaiMessages,
              stream: true,
              tools: openaiTools
            };
          } else if (aiProvider === 'deepseek') {
            fetchUrl = "https://api.deepseek.com/v1/chat/completions";
            fetchHeaders["Authorization"] = `Bearer ${activeApiKey}`;
            
            const deepseekTools = mcpEnabled && mcpTools.length > 0
              ? mcpTools.map(t => ({
                  type: "function",
                  function: {
                    name: t.name,
                    description: t.description,
                    parameters: t.inputSchema
                  }
                }))
              : undefined;

            const deepseekMessages = [
              { role: "system", content: systemPrompt },
              ...activeHistory.map(m => {
                if (m.role === 'tool') {
                  return { role: "tool", tool_call_id: m.tool_call_id, name: m.name, content: m.content };
                }
                if (m.tool_calls) {
                  return {
                    role: "assistant",
                    tool_calls: m.tool_calls.map(tc => ({
                      id: tc.id,
                      type: "function",
                      function: { name: tc.name, arguments: JSON.stringify(tc.args) }
                    }))
                  };
                }
                return { role: m.role === 'model' ? 'assistant' : 'user', content: m.content };
              })
            ];

            fetchBody = {
              model: normalizeAiModel(aiProvider, aiModel),
              messages: deepseekMessages,
              stream: true,
              tools: deepseekTools
            };
          } else if (aiProvider === 'claude') {
            fetchUrl = "https://api.anthropic.com/v1/messages";
            fetchHeaders["x-api-key"] = activeApiKey;
            fetchHeaders["anthropic-version"] = "2023-06-01";
            fetchHeaders["anthropic-dangerous-direct-browser-access"] = "true";

            const claudeTools = mcpEnabled && mcpTools.length > 0
              ? mcpTools.map(t => ({
                  name: t.name,
                  description: t.description,
                  input_schema: t.inputSchema
                }))
              : undefined;

            // Map history to Anthropic format
            const claudeMessages = activeHistory.map(m => {
              if (m.role === 'tool') {
                return {
                  role: "user",
                  content: [{ type: "tool_result", tool_use_id: m.tool_call_id, content: m.content }]
                };
              }
              if (m.tool_calls) {
                return {
                  role: "assistant",
                  content: m.tool_calls.map(tc => ({
                    type: "tool_use",
                    id: tc.id,
                    name: tc.name,
                    input: tc.args
                  }))
                };
              }
              return { role: m.role === 'model' ? 'assistant' : 'user', content: m.content };
            });

            fetchBody = {
              model: aiModel,
              system: systemPrompt,
              messages: claudeMessages,
              stream: true,
              max_tokens: 4000,
              tools: claudeTools
            };
          }

          // Trigger completion call
          let response;
          if (mcpEnabled && mcpUrl) {
            // route through CORS bypass proxy
            const requestUrl = mcpSecret 
              ? (mcpUrl.endsWith(mcpSecret) ? `${mcpUrl}/proxy` : `${mcpUrl}/${mcpSecret}/proxy`)
              : `${mcpUrl}/proxy`;
            response = await fetch(requestUrl, {
              method: 'POST',
              signal: abortController.signal,
              headers: {
                'Content-Type': 'application/json',
                ...(mcpSecret ? { 'Authorization': `Bearer ${mcpSecret}` } : {})
              },
              body: JSON.stringify({
                url: fetchUrl,
                headers: fetchHeaders,
                method: 'POST',
                body: fetchBody
              })
            });
          } else {
            response = await fetch(fetchUrl, {
              method: 'POST',
              signal: abortController.signal,
              headers: fetchHeaders,
              body: JSON.stringify(fetchBody)
            });
          }

          if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`API failed: status ${response.status} - ${errBody || 'Unknown API failure'}`);
          }

          // Parse stream
          const reader = response.body.getReader();
          const decoder = new TextDecoder("utf-8");
          let buffer = "";
          let accumulatedText = "";
          let toolCallsAccumulator = [];

          // Add a temporary text placeholder
          setChatLog(prev => [...prev, { role: 'model', content: '' }]);

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              // Parse OpenAI / DeepSeek SSE format
              if (trimmed.startsWith('data: ')) {
                const dataStr = trimmed.slice(6);
                if (dataStr === '[DONE]') continue;
                try {
                  const parsed = JSON.parse(dataStr);
                  const choice = parsed.choices?.[0];
                  if (choice) {
                    if (choice.delta?.content) {
                      accumulatedText += choice.delta.content;
                      setChatLog(prev => {
                        const next = [...prev];
                        next[next.length - 1] = { role: 'model', content: accumulatedText };
                        return next;
                      });
                    }
                    if (choice.delta?.tool_calls) {
                      for (const tc of choice.delta.tool_calls) {
                        const idx = tc.index ?? 0;
                        if (!toolCallsAccumulator[idx]) {
                           toolCallsAccumulator[idx] = { id: '', name: '', arguments: '' };
                        }
                        if (tc.id) toolCallsAccumulator[idx].id = tc.id;
                        if (tc.class) toolCallsAccumulator[idx].class = tc.class;
                        if (tc.function?.name) toolCallsAccumulator[idx].name = tc.function.name;
                        if (tc.function?.arguments) toolCallsAccumulator[idx].arguments += tc.function.arguments;
                      }
                    }
                  }
                } catch (e) {}
              } 
              // Parse Anthropic SSE format
              else if (trimmed.startsWith('data:')) {
                try {
                  const parsed = JSON.parse(trimmed.slice(trimmed.indexOf('{')));
                  if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                    accumulatedText += parsed.delta.text;
                    setChatLog(prev => {
                      const next = [...prev];
                      next[next.length - 1] = { role: 'model', content: accumulatedText };
                      return next;
                    });
                  }
                  if (parsed.type === 'content_block_start' && parsed.content_block?.type === 'tool_use') {
                    const tb = parsed.content_block;
                    toolCallsAccumulator.push({ id: tb.id, name: tb.name, arguments: '' });
                  }
                  if (parsed.type === 'content_block_delta' && parsed.delta?.partial_json) {
                    const activeCall = toolCallsAccumulator[toolCallsAccumulator.length - 1];
                    if (activeCall) activeCall.arguments += parsed.delta.partial_json;
                  }
                } catch (e) {}
              }
            }
          }

          // Evaluate tool calling requests
          let requestedToolCalls = toolCallsAccumulator
            .filter(tc => tc && tc.name)
            .map(tc => {
              let args = {};
              try { args = JSON.parse(tc.arguments || '{}'); } catch (e) {}
              return { id: tc.id, name: tc.name, args };
            });

          // Check for raw text-based function calls if no native tool calling was triggered
          if (requestedToolCalls.length === 0 && accumulatedText.includes('<function_call>')) {
            const inlineMatch = accumulatedText.match(/<function_call>(\w+)\(([\s\S]*?)\)<\/function_call>/);
            if (inlineMatch) {
              try {
                const name = inlineMatch[1];
                const args = JSON.parse(inlineMatch[2].trim());
                requestedToolCalls = [{ id: name, name, args }];
              } catch (e) {}
            }
          }

          if (requestedToolCalls.length > 0) {
            toolCallAttempts++;
            // Remove text placeholder
            setChatLog(prev => prev.slice(0, -1));

            // Log tool execution in feed
            setChatLog(prev => [...prev, {
              role: 'model',
              content: `🔧 *System: Executing ${requestedToolCalls.length} tool(s)...*`
            }]);
            logSync(`Copilot: Invoking ${requestedToolCalls.length} tools via proxy`, 'info', requestedToolCalls.map(tc => tc.name).join(', '));

            const toolResponses = [];
            for (const tc of requestedToolCalls) {
              logSync(`Copilot: Executing tool "${tc.name}"`, 'info', JSON.stringify(tc.args));
              const toolResult = await runMcpTool(tc.name, tc.args);
              logSync(`Copilot: Tool "${tc.name}" completed`, 'success');
              toolResponses.push({
                role: 'tool',
                tool_call_id: tc.id,
                name: tc.name,
                content: JSON.stringify(toolResult)
              });
            }

            // Remove system execution message
            setChatLog(prev => prev.slice(0, -1));

            // Append context
            activeHistory.push({ role: 'model', tool_calls: requestedToolCalls });
            activeHistory.push(...toolResponses);
          } else {
            logSync(`Copilot: Text response generation complete`, 'success');
            finalResponseGenerated = true;
          }
        }
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[Copilot] Generation cancelled by user.');
        logSync('Copilot: Generation aborted by user', 'info');
        // Clean up any empty message from feed
        setChatLog(prev => prev.filter(m => m.content !== ''));
        return;
      }
      console.error(err);
      let msg = err.message || 'Failed to generate response. Check your API configurations.';
      if (msg.includes('429')) {
        msg = 'Copilot rate limit exceeded. Please wait a moment before sending another message.';
      }
      setErrorMessage(msg);
      logSync(`Copilot Error: ${msg}`, 'error');
      
      // Clean up empty bubbles and insert actual error message in conversation flow
      setChatLog(prev => {
        const filtered = prev.filter(m => m.content !== '');
        // Check if last message is a system execution message
        const last = filtered[filtered.length - 1];
        if (last && last.content && last.content.includes('Executing')) {
          filtered.pop();
        }
        return [...filtered, { role: 'model', content: `❌ **Copilot Error**: ${msg}`, isError: true }];
      });
    } finally {
      setIsGenerating(false);
      setToolStatus('');
      if (activeAbortControllerRef.current === abortController) {
        activeAbortControllerRef.current = null;
      }
    }
  };

  if (!activeApiKey) {
    return (
      <OnboardingKeyScreen
        aiProvider={aiProvider}
        aiModel={aiModel}
        onboardingKeyInput={onboardingKeyInput}
        setOnboardingKeyInput={setOnboardingKeyInput}
        handleSaveOnboardingKey={handleSaveOnboardingKey}
      />
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-200px)] md:h-[calc(100vh-140px)] max-w-4xl mx-auto pb-4">
      {/* Sticky Assistant Header */}
      <AssistantHeader
        fiduciaryMode={fiduciaryMode}
        handleToggleFiduciaryMode={handleToggleFiduciaryMode}
        aiProvider={aiProvider}
        aiModel={aiModel}
        mcpEnabled={mcpEnabled}
        mcpStatus={mcpStatus}
        mcpToolsLength={mcpTools.length}
      />

      {/* Message Feed */}
      <MessageFeed
        chatLog={chatLog}
        isGenerating={isGenerating}
        fiduciaryMode={fiduciaryMode}
        triggerFiduciaryAudit={triggerFiduciaryAudit}
        activeSuggestions={activeSuggestions}
        toolStatus={toolStatus}
        chatEndRef={chatEndRef}
        handleSendMessage={handleSendMessage}
      />

      {/* Privacy & Trust Controls */}
      <PrivacyControls
        redactSensitiveData={redactSensitiveData}
        handleToggleRedact={handleToggleRedact}
        aggregateOnlyMode={aggregateOnlyMode}
        handleToggleAggregateOnly={handleToggleAggregateOnly}
        setChatLog={setChatLog}
        showSharedContext={showSharedContext}
        setShowSharedContext={setShowSharedContext}
        financialContext={financialContext}
      />

      {/* Message Input Form */}
      <ChatInput
        userInput={userInput}
        setUserInput={setUserInput}
        isGenerating={isGenerating}
        toolStatus={toolStatus}
        errorMessage={errorMessage}
        activeAbortControllerRef={activeAbortControllerRef}
        handleSendMessage={handleSendMessage}
      />

      {/* Shared Prompt Context Inspector */}
      <SharedContextDrawer
        showSharedContext={showSharedContext}
        setShowSharedContext={setShowSharedContext}
        financialContext={financialContext}
      />
    </div>
  );
}
