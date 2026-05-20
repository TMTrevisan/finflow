import React, { useState, Suspense, lazy } from 'react';
import Layout from './components/layout/Layout';
import PasscodeLock from './components/ui/PasscodeLock';
import { AppProvider } from './context/AppContext';

// Lazy-load all views for code-splitting performance
const Dashboard = lazy(() => import('./views/Dashboard'));
const Spending = lazy(() => import('./views/Spending'));
const Income = lazy(() => import('./views/Income'));
const Transactions = lazy(() => import('./views/Transactions'));
const Budgets = lazy(() => import('./views/Budgets'));
const CashFlow = lazy(() => import('./views/CashFlow'));
const Settings = lazy(() => import('./views/Settings'));
const PLReport = lazy(() => import('./views/PLReport'));
const YearlyInsights = lazy(() => import('./views/YearlyInsights'));
const Insights = lazy(() => import('./views/Insights'));
const Assistant = lazy(() => import('./views/Assistant'));
const Subscriptions = lazy(() => import('./views/Subscriptions'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[300px]">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-8 h-8 border-2 border-neon-indigo/30 border-t-neon-indigo rounded-full animate-spin" />
      <span className="text-xs text-slate-500">Loading...</span>
    </div>
  </div>
);

function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard setCurrentView={setCurrentView} />;
      case 'assistant': return <Assistant />;
      case 'spending': return <Spending />;
      case 'income': return <Income />;
      case 'transactions': return <Transactions />;
      case 'budgets': return <Budgets setCurrentView={setCurrentView} />;
      case 'subscriptions': return <Subscriptions />;
      case 'cashflow': return <CashFlow />;
      case 'settings': return <Settings />;
      case 'plreport': return <PLReport />;
      case 'yearly': return <YearlyInsights />;
      case 'insights': return <Insights />;
      default: return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <AppProvider setCurrentView={setCurrentView}>
      <PasscodeLock>
        <Layout currentView={currentView} setCurrentView={setCurrentView}>
          <Suspense fallback={<LoadingFallback />}>
            {renderView()}
          </Suspense>
        </Layout>
      </PasscodeLock>
    </AppProvider>
  );
}

export default App;
