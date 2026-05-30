import React, { useState, Suspense, lazy, useEffect } from 'react';
import Layout from './components/layout/Layout';
import PasscodeLock from './components/ui/PasscodeLock';
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ui/ErrorBoundary';

// Helper to catch chunk load errors and reload the page automatically to fetch latest deployment files
const safeLazy = (importFn) => {
  return lazy(() => 
    importFn().catch(err => {
      console.warn("Dynamic import failed, reloading page to get latest version...", err);
      window.location.reload();
      return new Promise(() => {}); // Suspend while page reloads
    })
  );
};

// Lazy-load all views safely for code-splitting performance
const Dashboard = safeLazy(() => import('./views/Dashboard'));
const Spending = safeLazy(() => import('./views/Spending'));
const Income = safeLazy(() => import('./views/Income'));
const Transactions = safeLazy(() => import('./views/Transactions'));
const Budgets = safeLazy(() => import('./views/Budgets'));
const CashFlow = safeLazy(() => import('./views/CashFlow'));
const Settings = safeLazy(() => import('./views/Settings'));
const PLReport = safeLazy(() => import('./views/PLReport'));
const YearlyInsights = safeLazy(() => import('./views/YearlyInsights'));
const Insights = safeLazy(() => import('./views/Insights'));
const Assistant = safeLazy(() => import('./views/Assistant'));
const Subscriptions = safeLazy(() => import('./views/Subscriptions'));
const Accounts = safeLazy(() => import('./views/Accounts'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[300px]">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-8 h-8 border-2 border-neon-indigo/30 border-t-neon-indigo rounded-full animate-spin" />
      <span className="text-xs text-slate-500">Loading...</span>
    </div>
  </div>
);

function App() {
  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '');
    const validViews = [
      'dashboard', 'assistant', 'spending', 'income', 'transactions', 
      'budgets', 'subscriptions', 'cashflow', 'settings', 'plreport', 
      'yearly', 'insights', 'accounts'
    ];
    return validViews.includes(hash) ? hash : 'dashboard';
  };

  const [currentView, setCurrentView] = useState(getInitialView);

  // Sync hash with currentView
  useEffect(() => {
    window.location.hash = currentView;
  }, [currentView]);

  // Sync currentView with hash changes (e.g. back button or deep links)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '');
      const validViews = [
        'dashboard', 'assistant', 'spending', 'income', 'transactions', 
        'budgets', 'subscriptions', 'cashflow', 'settings', 'plreport', 
        'yearly', 'insights', 'accounts'
      ];
      if (validViews.includes(hash) && hash !== currentView) {
        setCurrentView(hash);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [currentView]);

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
      case 'accounts': return <Accounts setCurrentView={setCurrentView} />;
      default: return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <AppProvider setCurrentView={setCurrentView}>
      <PasscodeLock>
        <Layout currentView={currentView} setCurrentView={setCurrentView}>
          <ErrorBoundary key={currentView}>
            <Suspense fallback={<LoadingFallback />}>
              {renderView()}
            </Suspense>
          </ErrorBoundary>
        </Layout>
      </PasscodeLock>
    </AppProvider>
  );
}

export default App;
