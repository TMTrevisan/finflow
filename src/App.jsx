import React, { useState } from 'react';
import Layout from './components/layout/Layout';
import Dashboard from './views/Dashboard';
import Spending from './views/Spending';
import Income from './views/Income';
import Transactions from './views/Transactions';
import Budgets from './views/Budgets';
import CashFlow from './views/CashFlow';
import Settings from './views/Settings';
import PasscodeLock from './components/ui/PasscodeLock';

function App() {
  const [currentView, setCurrentView] = useState('dashboard');

  const renderView = () => {
    switch (currentView) {
      case 'dashboard': return <Dashboard />;
      case 'spending': return <Spending />;
      case 'income': return <Income />;
      case 'transactions': return <Transactions />;
      case 'budgets': return <Budgets />;
      case 'cashflow': return <CashFlow />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  return (
    <PasscodeLock>
      <Layout currentView={currentView} setCurrentView={setCurrentView}>
        {renderView()}
      </Layout>
    </PasscodeLock>
  );
}

export default App;
