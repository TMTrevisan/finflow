import React from 'react';
import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import Header from './Header';

export default function Layout({ currentView, setCurrentView, children }) {
  // Copilot needs more bottom padding to clear the nav + its own input bar
  const bottomPadding = currentView === 'assistant' ? 'pb-36 md:pb-8' : 'pb-24 md:pb-8';

  return (
    <div className="flex h-screen bg-black overflow-hidden text-slate-200">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header 
          title={currentView === 'plreport' ? 'P&L Report' : currentView === 'yearly' ? 'Yearly Insights' : currentView} 
          currentView={currentView} 
          setCurrentView={setCurrentView} 
        />
        
        <main className={`flex-1 overflow-y-auto p-4 md:p-8 ${bottomPadding}`}>
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
      
      <BottomNav currentView={currentView} setCurrentView={setCurrentView} />
    </div>
  );
}
