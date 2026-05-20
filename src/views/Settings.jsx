import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { Card, CardContent } from '../components/ui/Card';
import { 
  Link, 
  Lock, 
  Unlock, 
  Trash2, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  HardDrive,
  KeyRound
} from 'lucide-react';

export default function Settings() {
  const { 
    syncData, 
    clearCache, 
    loadData, 
    lastSync, 
    transactions, 
    categories, 
    balances,
    isMockData,
    isSyncing
  } = useAppContext();

  // URL state
  const [apiUrlInput, setApiUrlInput] = useState(() => {
    return localStorage.getItem('finflow_api_url') || '';
  });
  const [urlMessage, setUrlMessage] = useState(null);

  // Passcode state
  const [passcodeEnabled, setPasscodeEnabled] = useState(() => {
    return !!localStorage.getItem('finflow_passcode');
  });
  const [pinInput, setPinInput] = useState('');
  const [passcodeMessage, setPasscodeMessage] = useState(null);

  // Cache diagnostics
  const transactionCount = transactions.length;
  const categoryCount = categories.length;
  const balanceCount = balances.length;
  
  const cacheSizeEstimate = useMemo(() => {
    let charCount = 0;
    try {
      charCount += (localStorage.getItem('finflow_cache_transactions') || '').length;
      charCount += (localStorage.getItem('finflow_cache_categories') || '').length;
      charCount += (localStorage.getItem('finflow_cache_balances') || '').length;
    } catch (e) {}
    // Estimate bytes (utf-16 characters = 2 bytes)
    const kb = (charCount * 2) / 1024;
    return kb.toFixed(1);
  }, [transactions, categories, balances]);

  const handleSaveUrl = async () => {
    setUrlMessage({ type: 'info', text: 'Saving and validating connection...' });
    if (!apiUrlInput.trim()) {
      localStorage.removeItem('finflow_api_url');
      setUrlMessage({ type: 'success', text: 'URL cleared. App will fall back to local .env or Mock Data.' });
      loadData(true);
      return;
    }

    try {
      // Temporarily store to test the sync
      const previousUrl = localStorage.getItem('finflow_api_url');
      localStorage.setItem('finflow_api_url', apiUrlInput.trim());
      
      const success = await syncData();
      if (success) {
        setUrlMessage({ type: 'success', text: 'Connection verified! Your sheet is successfully connected.' });
      } else {
        // Revert
        if (previousUrl) {
          localStorage.setItem('finflow_api_url', previousUrl);
        } else {
          localStorage.removeItem('finflow_api_url');
        }
        setUrlMessage({ type: 'error', text: 'Connection failed. Verify the URL is correct and Apps Script is deployed as "Anyone".' });
      }
    } catch (err) {
      setUrlMessage({ type: 'error', text: `Verification error: ${err.message}` });
    }
  };

  const handleTogglePasscode = () => {
    const isCurrentlyEnabled = !!localStorage.getItem('finflow_passcode');
    if (isCurrentlyEnabled) {
      // Disable
      localStorage.removeItem('finflow_passcode');
      setPasscodeEnabled(false);
      setPinInput('');
      setPasscodeMessage({ type: 'success', text: 'PIN Passcode disabled successfully.' });
    } else {
      // Enable PIN
      if (pinInput.length !== 4 || isNaN(Number(pinInput))) {
        setPasscodeMessage({ type: 'error', text: 'Please enter a valid 4-digit numeric PIN.' });
        return;
      }
      localStorage.setItem('finflow_passcode', pinInput);
      setPasscodeEnabled(true);
      setPasscodeMessage({ type: 'success', text: `PIN Passcode configured! Next time you open the app, you will need this PIN.` });
    }
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString('default', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-white">Settings</h1>
        <p className="text-sm text-slate-400">Manage spreadsheet connections, security preferences, and database cache settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Connection Settings Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Link size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Google Sheets Integration</h3>
                <p className="text-xs text-slate-500">Provide your Google Apps Script API endpoint.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Apps Script Web App URL</label>
              <input 
                type="text" 
                value={apiUrlInput}
                onChange={(e) => setApiUrlInput(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
              />
            </div>

            {urlMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                urlMessage.type === 'success' 
                  ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                  : urlMessage.type === 'error'
                    ? 'bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson'
                    : 'bg-obsidian-800 border-obsidian-750 text-slate-300'
              }`}>
                {urlMessage.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : urlMessage.type === 'error' ? (
                  <AlertTriangle size={16} className="shrink-0" />
                ) : (
                  <RefreshCw size={16} className="animate-spin shrink-0" />
                )}
                <span>{urlMessage.text}</span>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-obsidian-800/40 flex justify-end">
            <button
              onClick={handleSaveUrl}
              disabled={isSyncing}
              className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors shadow-md disabled:opacity-50"
            >
              Verify & Connect Sheet
            </button>
          </div>
        </Card>

        {/* Security Settings Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Passcode Protection</h3>
                <p className="text-xs text-slate-500">Secure your database UI with a 4-digit PIN lock.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-obsidian-800/40 p-3 rounded-xl border border-obsidian-850">
                <span className="text-xs font-semibold text-slate-300">Status</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  passcodeEnabled 
                    ? 'bg-neon-indigo/15 text-neon-indigo border-neon-indigo/25' 
                    : 'bg-slate-500/10 text-slate-400 border-slate-700/25'
                }`}>
                  {passcodeEnabled ? 'Shield Enabled' : 'Disabled'}
                </span>
              </div>

              {!passcodeEnabled && (
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Set 4-Digit Passcode PIN</label>
                  <input 
                    type="password" 
                    maxLength={4}
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="e.g. 1234"
                    className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs text-center font-bold tracking-[0.75em] focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
                  />
                </div>
              )}
            </div>

            {passcodeMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                passcodeMessage.type === 'success' 
                  ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                  : 'bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson'
              }`}>
                {passcodeMessage.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="shrink-0" />
                )}
                <span>{passcodeMessage.text}</span>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-obsidian-800/40 flex justify-end">
            <button
              onClick={handleTogglePasscode}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center space-x-2 ${
                passcodeEnabled 
                  ? 'bg-neon-crimson/20 hover:bg-neon-crimson/30 text-neon-crimson border border-neon-crimson/35'
                  : 'bg-neon-indigo hover:bg-neon-indigo-hover text-white'
              }`}
            >
              {passcodeEnabled ? (
                <>
                  <Unlock size={14} />
                  <span>Disable PIN Shield</span>
                </>
              ) : (
                <>
                  <KeyRound size={14} />
                  <span>Enable PIN Shield</span>
                </>
              )}
            </button>
          </div>
        </Card>

        {/* Database Cache Manager */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 md:col-span-2 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
              <HardDrive size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Cache & Diagnostics</h3>
              <p className="text-xs text-slate-500">Manage offline database caching stats and performance.</p>
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transactions</span>
              <span className="text-xl font-bold text-white">{transactionCount} rows</span>
            </div>
            <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Categories</span>
              <span className="text-xl font-bold text-white">{categoryCount} items</span>
            </div>
            <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Accounts</span>
              <span className="text-xl font-bold text-white">{balanceCount} accounts</span>
            </div>
            <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cache Size</span>
              <span className="text-xl font-bold text-white">{cacheSizeEstimate} KB</span>
            </div>
          </div>

          {/* Last Sync */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-obsidian-800/40 border border-obsidian-850 rounded-2xl">
            <div>
              <p className="text-xs font-semibold text-slate-400">Last Database Sync Time</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5">{formatLastSync(lastSync)}</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={clearCache}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-neon-crimson/10 border border-neon-crimson/25 hover:bg-neon-crimson/25 text-neon-crimson rounded-xl text-xs font-bold transition-colors"
              >
                <Trash2 size={14} />
                <span>Clear Cache</span>
              </button>
              <button
                onClick={() => loadData(true)}
                disabled={isSyncing}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-800 border border-obsidian-750 hover:border-obsidian-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>Force Refetch</span>
              </button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
