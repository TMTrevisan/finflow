import React, { useState } from 'react';
import CashFlow from './CashFlow';
import Budgets from './Budgets';
import Subscriptions from './Subscriptions';
import Income from './Income';
import Spending from './Spending';

export default function CashFlowHub({ setCurrentView }) {
  const [activeTab, setActiveTab] = useState('sankey');

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-obsidian-800 space-x-6 pb-2">
        <button
          onClick={() => setActiveTab('sankey')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'sankey' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Sankey Flow
        </button>
        <button
          onClick={() => setActiveTab('budgets')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'budgets' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Budgets & Pacing
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'subscriptions' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Subscriptions
        </button>
        <button
          onClick={() => setActiveTab('spending')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'spending' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Spending Breakdown
        </button>
        <button
          onClick={() => setActiveTab('income')}
          className={`pb-2 font-bold text-sm transition-all border-b-2 cursor-pointer ${
            activeTab === 'income' 
              ? 'text-white border-neon-indigo' 
              : 'text-slate-500 border-transparent hover:text-slate-300'
          }`}
        >
          Income Breakdown
        </button>
      </div>

      <div className="mt-4">
        {activeTab === 'sankey' && <CashFlow />}
        {activeTab === 'budgets' && <Budgets setCurrentView={setCurrentView} />}
        {activeTab === 'subscriptions' && <Subscriptions />}
        {activeTab === 'spending' && <Spending />}
        {activeTab === 'income' && <Income />}
      </div>
    </div>
  );
}
