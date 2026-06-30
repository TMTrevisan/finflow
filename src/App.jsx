import React, { useState, Suspense, lazy, useEffect } from 'react';
import Layout from './components/layout/Layout';
import PasscodeLock from './components/ui/PasscodeLock';
import { AppProvider } from './context/AppContext';
import ErrorBoundary from './components/ui/ErrorBoundary';
import GlobalSearch from './components/ui/GlobalSearch';
import OnboardingModal from './components/ui/OnboardingModal';

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
const Wealth = safeLazy(() => import('./views/Wealth'));
const Transactions = safeLazy(() => import('./views/Transactions'));
const CashFlowHub = safeLazy(() => import('./views/CashFlowHub'));
const ReportsHub = safeLazy(() => import('./views/ReportsHub'));
const Assistant = safeLazy(() => import('./views/Assistant'));
const Insights = safeLazy(() => import('./views/Insights'));
const Settings = safeLazy(() => import('./views/Settings'));

// Standalone Google Sheets views restored
const Accounts = safeLazy(() => import('./views/Accounts'));
const Spending = safeLazy(() => import('./views/Spending'));
const Income = safeLazy(() => import('./views/Income'));
const Budgets = safeLazy(() => import('./views/Budgets'));
const CashFlow = safeLazy(() => import('./views/CashFlow'));
const PLReport = safeLazy(() => import('./views/PLReport'));
const YearlyInsights = safeLazy(() => import('./views/YearlyInsights'));
const Subscriptions = safeLazy(() => import('./views/Subscriptions'));

const LoadingFallback = () => (
  <div className="flex items-center justify-center h-full w-full min-h-[300px]">
    <div className="flex flex-col items-center space-y-3">
      <div className="w-8 h-8 border-2 border-neon-indigo/30 border-t-neon-indigo rounded-full animate-spin" />
      <span className="text-xs text-slate-500">Loading…</span>
    </div>
  </div>
);

function App() {
  const getInitialView = () => {
    const hash = window.location.hash.replace('#', '');
    const validViews = [
      'dashboard', 'wealth', 'transactions', 'cashflow', 'reports', 
      'assistant', 'insights', 'settings', 'accounts', 'spending',
      'income', 'budgets', 'subscriptions', 'sankey', 'plreport', 'yearly'
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
        'dashboard', 'wealth', 'transactions', 'cashflow', 'reports', 
        'assistant', 'insights', 'settings', 'accounts', 'spending',
        'income', 'budgets', 'subscriptions', 'sankey', 'plreport', 'yearly'
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
      case 'wealth': return <Wealth setCurrentView={setCurrentView} />;
      case 'transactions': return <Transactions />;
      case 'cashflow': return <CashFlowHub setCurrentView={setCurrentView} />;
      case 'reports': return <ReportsHub />;
      case 'assistant': return <Assistant />;
      case 'insights': return <Insights />;
      case 'settings': return <Settings />;
      
      // Standalone views
      case 'accounts': return <Accounts setCurrentView={setCurrentView} />;
      case 'spending': return <Spending />;
      case 'income': return <Income />;
      case 'budgets': return <Budgets setCurrentView={setCurrentView} />;
      case 'subscriptions': return <Subscriptions />;
      case 'sankey': return <CashFlow />;
      case 'plreport': return <PLReport />;
      case 'yearly': return <YearlyInsights />;
      
      default: return <Dashboard setCurrentView={setCurrentView} />;
    }
  };

  return (
    <AppProvider setCurrentView={setCurrentView}>
      <PasscodeLock>
        <GlobalSearch />
        <OnboardingModal />
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
