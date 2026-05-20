import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { cleanMerchantName, formatCurrency } from '../utils/formatting';
import { 
  Sparkles, 
  Send, 
  Brain, 
  Key, 
  HelpCircle,
  TrendingDown,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';

export default function Assistant() {
  const { transactions, categories, balances } = useAppContext();
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('finflow_gemini_key') || '');
  const [keyInput, setKeyInput] = useState('');
  
  const [chatLog, setChatLog] = useState([
    {
      role: 'model',
      content: "Hello! I'm your FinFlow Copilot. I have analyzed your accounts, category budgets, and transaction history. Ask me anything about your finances!"
    }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  
  const chatEndRef = useRef(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isGenerating]);

  // Handle saving API key inline
  const handleSaveApiKey = () => {
    if (keyInput.trim()) {
      localStorage.setItem('finflow_gemini_key', keyInput.trim());
      setApiKey(keyInput.trim());
      setErrorMessage('');
    }
  };

  // starter questions
  const SUGGESTIONS = [
    "Am I on track to save money this month?",
    "How does my grocery spend this month compare to my average?",
    "What are my top 3 largest transactions in the last 30 days?",
    "Which of my categories is closest to exceeding its budget limit?",
    "Analyze my recurring subscription costs.",
    "Do you see any unusual transactions or anomalies recently?"
  ];

  // Helper to compile structured financial context for Gemini
  const financialContext = useMemo(() => {
    // 1. Accounts context
    const accountsData = balances.map(b => ({
      inst: b.institution,
      name: b.account,
      bal: b.balance,
      cls: b.class,
      typ: b.type
    }));

    // Calculate totals
    const cashTotal = balances.filter(b => b.type === 'Checking' || b.type === 'Savings').reduce((sum, b) => sum + b.balance, 0);
    const creditTotal = balances.filter(b => b.type === 'Credit Card').reduce((sum, b) => sum + b.balance, 0);
    const investTotal = balances.filter(b => b.type === 'Investment').reduce((sum, b) => sum + b.balance, 0);
    const loanTotal = balances.filter(b => b.type === 'Loan').reduce((sum, b) => sum + b.balance, 0);

    // 2. Budget limits and actual spends this month
    const budgetData = categories.map(c => {
      const actualSpend = transactions
        .filter(t => t.category?.toLowerCase() === c.category?.toLowerCase() && t.type === 'Expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);

      return {
        cat: c.category,
        grp: c.group,
        typ: c.type,
        lim: c.budget,
        spent: actualSpend
      };
    }).filter(b => b.lim > 0 || b.spent > 0);

    // 3. Recent Transactions (last 25 rows for size safety)
    const sortedTxns = [...transactions]
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 25)
      .map(t => ({
        d: t.date,
        m: cleanMerchantName(t.description),
        c: t.category,
        a: t.amount,
        t: t.type,
        ac: t.account
      }));

    return {
      net: {
        cash: cashTotal,
        debt: creditTotal,
        inv: investTotal,
        loan: loanTotal,
        nw: (cashTotal + investTotal) - (Math.abs(creditTotal) + Math.abs(loanTotal))
      },
      accts: accountsData,
      budgets: budgetData,
      txns: sortedTxns
    };
  }, [transactions, categories, balances]);

  const handleSendMessage = async (textToSend) => {
    const promptText = textToSend || userInput;
    if (!promptText.trim() || isGenerating) return;

    setUserInput('');
    setErrorMessage('');
    setIsGenerating(true);

    // Append user message
    const updatedChat = [...chatLog, { role: 'user', content: promptText }];
    setChatLog(updatedChat);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const selectedModel = localStorage.getItem('finflow_gemini_model') || 'gemini-2.5-flash-lite';
      const model = genAI.getGenerativeModel({ 
        model: selectedModel,
        systemInstruction: `You are FinFlow Copilot, a brilliant, concise personal financial assistant.
You have secure access to the user's local financial database. Below is the compressed snapshot of their balances, budgets, and recent transactions.

<DatabaseContext>
${JSON.stringify(financialContext)}
</DatabaseContext>

Key Mappings:
- net: Net worth summary (nw: Net Worth, cash: Total Cash, debt: Credit Card Debt, inv: Investments, loan: Loans).
- accts: Active accounts (inst: Institution, name: Account Name, bal: Balance, cls: Class, typ: Type).
- budgets: Category Budgets (cat: Category Name, grp: Group, typ: Type, lim: Budget Limit, spent: Actual Spent).
- txns: Recent Transactions (d: Date, m: Merchant Name, c: Category, a: Amount, t: Type, ac: Account Name).

Rules:
1. Always prioritize exact figures from the context. Do not invent balances or categories.
2. Format currency nicely using standard dollar signs (e.g. $125.40).
3. Keep responses highly glanceable and direct. Use markdown tables, bold highlights, and bullet points.
4. If a user asks about historical trends outside the provided data, specify that your visibility is currently set to recent syncs.
5. Answer questions with actionable analysis (e.g., if groceries spend is high, note how much budget remains).
6. CRITICAL: At the very end of your response, always propose 2-3 context-appropriate follow-up questions the user might want to ask next. Format these suggestions exactly like: <suggestions>Question 1|Question 2|Question 3</suggestions>`
      });

      // Prepare conversation history for the API
      const contents = updatedChat.map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      const result = await model.generateContentStream({ contents });
      
      // Append a placeholder model message
      setChatLog(prev => [...prev, { role: 'model', content: '' }]);

      let accumulatedText = '';
      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        accumulatedText += chunkText;
        
        // Update the last message in chat history
        setChatLog(prev => {
          const next = [...prev];
          next[next.length - 1] = { role: 'model', content: accumulatedText };
          return next;
        });
      }
    } catch (err) {
      console.error(err);
      let msg = err.message || 'Failed to generate response. Check your API key and connection.';
      if (msg.includes('429') || msg.includes('quota') || msg.includes('Quota')) {
        msg = 'Copilot rate limit exceeded. Please wait 15-20 seconds before asking another question.';
      }
      setErrorMessage(msg);
      // Remove empty model placeholder if error occurred
      setChatLog(prev => prev.filter(m => m.content !== ''));
    } finally {
      setIsGenerating(false);
    }
  };

  // Helper to extract custom suggestion tags
  const parseSuggestions = (content) => {
    const match = content.match(/<suggestions>([\s\S]*?)<\/suggestions>/);
    if (!match) return { text: content, suggestions: [] };
    
    const textWithoutSuggestions = content.replace(/<suggestions>([\s\S]*?)<\/suggestions>/, '').trim();
    const suggestionsList = match[1]
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 0);
      
    return { text: textWithoutSuggestions, suggestions: suggestionsList };
  };

  // Simple client-side markdown formatter
  const renderMarkdown = (text) => {
    if (!text) return null;

    // Split text into paragraphs
    const paragraphs = text.split('\n');

    return paragraphs.map((para, i) => {
      let trimmed = para.trim();
      
      if (!trimmed) return <div key={i} className="h-2" />;

      // Header tags
      if (trimmed.startsWith('### ')) {
        return <h4 key={i} className="text-sm font-bold text-white mt-3 mb-1.5">{trimmed.replace('### ', '')}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={i} className="text-base font-bold text-white mt-4 mb-2">{trimmed.replace('## ', '')}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={i} className="text-lg font-black text-white mt-4 mb-2">{trimmed.replace('# ', '')}</h2>;
      }

      // Check for table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Skip separator row (e.g. |---|---|)
        if (trimmed.includes('---')) return null;
        
        const cells = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        
        return (
          <div key={i} className="flex border-b border-obsidian-800/80 py-1.5 text-xs text-slate-350 hover:bg-obsidian-800/10">
            {cells.map((cell, cellIdx) => (
              <span key={cellIdx} className={`flex-1 min-w-0 truncate ${cellIdx === cells.length - 1 ? 'text-right font-semibold text-slate-200' : ''}`}>
                {cell.replace(/\*\*/g, '')}
              </span>
            ))}
          </div>
        );
      }

      // Bullet points
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const cleanBullet = trimmed.replace(/^[-*]\s+/, '');
        return (
          <li key={i} className="text-xs text-slate-300 list-disc ml-4 my-1">
            {parseInlineMarkdown(cleanBullet)}
          </li>
        );
      }

      return (
        <p key={i} className="text-xs leading-relaxed text-slate-300 my-1">
          {parseInlineMarkdown(trimmed)}
        </p>
      );
    });
  };

  const parseInlineMarkdown = (line) => {
    // Regex for bold text (**bold**)
    const parts = line.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-extrabold text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // If no API Key is configured, show onboarding
  if (!apiKey) {
    return (
      <div className="flex flex-col items-center justify-center max-w-lg mx-auto h-[70vh] px-6 text-center space-y-6">
        <div className="bg-obsidian-800 p-5 rounded-3xl border border-obsidian-750/80 shadow-2xl relative">
          <div className="absolute -top-3 -right-3 bg-neon-indigo p-1.5 rounded-xl text-white shadow-glow">
            <Sparkles size={16} />
          </div>
          <Brain size={48} className="text-neon-indigo animate-pulse" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white font-display">Configure FinFlow Copilot</h1>
          <p className="text-sm text-slate-400">
            To query your local budget database with natural language, connect a Google Gemini API Key.
          </p>
        </div>

        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-5 w-full space-y-4">
          <div className="text-left space-y-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
              <span>Gemini API Key</span>
              <a 
                href="https://aistudio.google.com/" 
                target="_blank" 
                rel="noreferrer" 
                className="text-neon-indigo hover:underline normal-case font-bold flex items-center space-x-1"
              >
                <span>Get Free Key</span>
                <ArrowRight size={10} />
              </a>
            </label>
            <input 
              type="password" 
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste your AIzaSy key here..."
              className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
            />
          </div>

          <button
            onClick={handleSaveApiKey}
            className="w-full py-2.5 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-all shadow-md flex items-center justify-center space-x-2"
          >
            <Key size={14} />
            <span>Connect Assistant</span>
          </button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] max-w-4xl mx-auto pb-4">
      {/* Sticky Assistant Header */}
      <div className="flex items-center justify-between border-b border-obsidian-800/85 pb-4 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-neon-indigo/10 rounded-xl text-neon-indigo border border-neon-indigo/15">
            <Brain size={20} className="animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white font-display flex items-center space-x-1.5">
              <span>FinFlow Copilot</span>
              <span className="bg-neon-indigo/15 border border-neon-indigo/25 text-neon-indigo text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full select-none">Beta</span>
            </h1>
            <p className="text-[10px] text-slate-400">Contextual intelligence parsing local accounts & budgets</p>
          </div>
        </div>

        <button
          onClick={() => {
            localStorage.removeItem('finflow_gemini_key');
            setApiKey('');
          }}
          className="text-[10px] font-bold text-slate-500 hover:text-neon-crimson px-2.5 py-1.5 bg-obsidian-850 hover:bg-neon-crimson/5 rounded-xl border border-obsidian-750 transition-all"
        >
          Disconnect Key
        </button>
      </div>

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto py-4 space-y-4 px-1 hide-scrollbar">
        {chatLog.map((message, index) => {
          const isModel = message.role === 'model';
          const { text, suggestions } = isModel ? parseSuggestions(message.content) : { text: message.content, suggestions: [] };

          return (
            <div 
              key={index}
              className={`flex items-start gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'model' && (
                <div className="p-1.5 bg-neon-indigo/15 rounded-lg border border-neon-indigo/25 text-neon-indigo shrink-0">
                  <Brain size={14} />
                </div>
              )}

              <div className="flex flex-col space-y-2 max-w-[85%]">
                <div className={`p-4 rounded-2xl border shadow-sm ${
                  message.role === 'user'
                    ? 'bg-neon-indigo/15 border-neon-indigo/25 text-slate-200'
                    : 'bg-obsidian-800/40 border-obsidian-800/80 text-slate-300'
                }`}>
                  <div className="space-y-2">
                    {text ? renderMarkdown(text) : (
                      <div className="flex items-center space-x-2 text-xs text-slate-500">
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Analyzing database variables...</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Render inline follow-up suggestion chips */}
                {isModel && suggestions.length > 0 && !isGenerating && index === chatLog.length - 1 && (
                  <div className="flex flex-wrap gap-2 pt-1 animate-fade-in">
                    {suggestions.map((suggestionText, sugIdx) => (
                      <button
                        key={sugIdx}
                        onClick={() => handleSendMessage(suggestionText)}
                        className="text-left px-3.5 py-1.5 bg-obsidian-800/45 hover:bg-neon-indigo/15 border border-obsidian-750 hover:border-neon-indigo/40 text-[10px] font-semibold text-slate-300 hover:text-white rounded-full transition-all duration-150 active:scale-[0.98] shadow-sm"
                      >
                        {suggestionText}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        {/* Starter suggestion chips */}
        {chatLog.length === 1 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-6 max-w-2xl">
            {SUGGESTIONS.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s)}
                className="text-left p-3.5 bg-obsidian-800/35 hover:bg-obsidian-800/60 border border-obsidian-800/80 rounded-2xl text-xs font-semibold text-slate-300 hover:text-white transition-all duration-150 flex items-center justify-between group active:scale-[0.98]"
              >
                <span>{s}</span>
                <ArrowRight size={14} className="text-slate-500 group-hover:text-neon-indigo group-hover:translate-x-1 transition-all shrink-0 ml-3" />
              </button>
            ))}
          </div>
        )}
        
        <div ref={chatEndRef} />
      </div>

      {/* Input bar */}
      <div className="pt-2 shrink-0">
        {errorMessage && (
          <div className="mb-2 p-3 rounded-xl border bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson text-xs flex items-center space-x-2 animate-bounce">
            <AlertCircle size={14} className="shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}
        
        <form 
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input 
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={isGenerating}
            placeholder={isGenerating ? "Processing models..." : "Ask Copilot e.g., 'Am I over budget on groceries?'"}
            className="w-full bg-obsidian-800/90 border border-obsidian-750/90 focus:border-neon-indigo/60 text-white rounded-2xl pl-4 pr-12 py-3.5 text-xs focus:outline-none focus:ring-1 focus:ring-neon-indigo/30 transition-all placeholder-slate-500 shadow-xl"
          />
          <button
            type="submit"
            disabled={!userInput.trim() || isGenerating}
            className="absolute right-2 p-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-md"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
