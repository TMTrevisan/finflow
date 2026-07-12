import React from 'react';
import { useAppContext } from '../context/AppContext';
import SheetsIntegrationCard from '../components/settings/SheetsIntegrationCard';
import PeriodAnchoringCard from '../components/settings/PeriodAnchoringCard';
import AdvancedFeaturesCard from '../components/settings/AdvancedFeaturesCard';
import SecuritySettingsCard from '../components/settings/SecuritySettingsCard';
import CopilotSettingsCard from '../components/settings/CopilotSettingsCard';
import SnapTradeConnectionCard from '../components/settings/SnapTradeConnectionCard';
import CacheDiagnosticsCard from '../components/settings/CacheDiagnosticsCard';

export default function Settings() {
  const { 
    syncData, 
    clearCache, 
    clearSnapTradeCache,
    loadData, 
    lastSync, 
    transactions = [], 
    categories = [], 
    balances = [],
    isSyncing,
    useCalendarToday,
    setUseCalendarToday,
    enableCustomSplits,
    setEnableCustomSplits,
    partnerAName,
    setPartnerAName,
    partnerBName,
    setPartnerBName,
    partnerAEmployer,
    setPartnerAEmployer,
    partnerBEmployer,
    setPartnerBEmployer,
    snapTradeStatus,
    snapTradeHoldings,
    loadSnapTradeData,
    getSnapTradeUrl,
    forceMock,
    setForceMock,
    logSync
  } = useAppContext();

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      <div className="flex flex-col space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-white font-display">Settings</h1>
        <p className="text-sm text-slate-400">Manage spreadsheet connections, security credentials, and local database cache settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Settings Card */}
        <SheetsIntegrationCard 
          syncData={syncData} 
          loadData={loadData} 
          isSyncing={isSyncing} 
        />

        {/* Period Anchoring Card */}
        <PeriodAnchoringCard 
          useCalendarToday={useCalendarToday} 
          setUseCalendarToday={setUseCalendarToday} 
        />

        {/* Custom Splits Settings Card */}
        <AdvancedFeaturesCard
          enableCustomSplits={enableCustomSplits}
          setEnableCustomSplits={setEnableCustomSplits}
          partnerAName={partnerAName}
          setPartnerAName={setPartnerAName}
          partnerBName={partnerBName}
          setPartnerBName={setPartnerBName}
          partnerAEmployer={partnerAEmployer}
          setPartnerAEmployer={setPartnerAEmployer}
          partnerBEmployer={partnerBEmployer}
          setPartnerBEmployer={setPartnerBEmployer}
        />

        {/* Security Settings (Passcode + Biometrics) */}
        <SecuritySettingsCard />

        {/* Copilot LLM + MCP Settings */}
        <CopilotSettingsCard />

        {/* SnapTrade Integration Card */}
        <SnapTradeConnectionCard 
          snapTradeStatus={snapTradeStatus}
          loadSnapTradeData={loadSnapTradeData}
          getSnapTradeUrl={getSnapTradeUrl}
          logSync={logSync}
        />

        {/* Cache Diagnostics (PWA, logs, clear Cache) */}
        <CacheDiagnosticsCard
          clearCache={clearCache}
          clearSnapTradeCache={clearSnapTradeCache}
          loadData={loadData}
          lastSync={lastSync}
          transactions={transactions}
          categories={categories}
          balances={balances}
          isSyncing={isSyncing}
          forceMock={forceMock}
          setForceMock={setForceMock}
          snapTradeStatus={snapTradeStatus}
          snapTradeHoldings={snapTradeHoldings}
        />
      </div>
    </div>
  );
}
