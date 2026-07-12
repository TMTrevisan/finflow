import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { CreditCard, KeyRound, Trash2, CheckCircle2, AlertTriangle, RefreshCw, Link } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export default function SnapTradeConnectionCard({
  snapTradeStatus = {},
  loadSnapTradeData,
  getSnapTradeUrl,
  logSync
}) {
  const [snapTradeSyncing, setSnapTradeSyncing] = useState(false);
  const [snapTradeMessage, setSnapTradeMessage] = useState(null);
  const [clientId, setClientId] = useState(() => safeStorage.getItem('finflow_snaptrade_client_id') || '');
  const [consumerKey, setConsumerKey] = useState(() => safeStorage.getItem('finflow_snaptrade_consumer_key') || '');
  const [userIdInput, setUserIdInput] = useState(() => safeStorage.getItem('finflow_snaptrade_user_id') || '');
  const [showAdvancedSnapTrade, setShowAdvancedSnapTrade] = useState(false);
  const [isSavingKeys, setIsSavingKeys] = useState(false);

  useEffect(() => {
    loadSnapTradeData().catch((err) => {
      setSnapTradeMessage({ type: 'error', text: `Failed to load SnapTrade: ${err.message}` });
    });
  }, [loadSnapTradeData]);

  const getSnapTradeHeaders = () => {
    return {
      'Content-Type': 'application/json',
      'x-snaptrade-client-id': safeStorage.getItem('finflow_snaptrade_client_id') || '',
      'x-snaptrade-consumer-key': safeStorage.getItem('finflow_snaptrade_consumer_key') || '',
      'x-snaptrade-user-id': safeStorage.getItem('finflow_snaptrade_user_id') || '',
      'x-snaptrade-user-secret': safeStorage.getItem('finflow_snaptrade_user_secret') || ''
    };
  };

  const handleLinkAccount = async () => {
    if (logSync) logSync('finflow snaptrade login --portal', 'cmd');
    setSnapTradeSyncing(true);
    setSnapTradeMessage({ type: 'info', text: 'Generating connection portal link...' });
    try {
      const url = getSnapTradeUrl('api/snaptrade/create_portal_url');
      const response = await fetch(url, { 
        method: 'POST',
        headers: getSnapTradeHeaders()
      });
      if (!response.ok) throw new Error('Failed to generate connection portal URL');
      const data = await response.json();
      
      if (data.userId) {
        safeStorage.setItem('finflow_snaptrade_user_id', data.userId);
      }
      if (data.userSecret) {
        safeStorage.setItem('finflow_snaptrade_user_secret', data.userSecret);
      }

      if (data.redirectURI) {
        setSnapTradeMessage({ type: 'info', text: 'Opening SnapTrade Connection Portal. Please complete the login in the new tab.' });
        if (logSync) logSync('Opening SnapTrade Connection Portal...', 'info', 'Portal URL generated');
        window.open(data.redirectURI, '_blank');
        
        setTimeout(async () => {
          await loadSnapTradeData();
          setSnapTradeMessage({ type: 'success', text: 'Brokerage authentication portal opened. Click "Sync Now" if your account does not sync automatically.' });
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to get portal link');
      }
    } catch (err) {
      if (logSync) logSync('Generating connection portal link failed', 'error', err.message);
      setSnapTradeMessage({ type: 'error', text: `Failed to open connection portal: ${err.message}` });
    } finally {
      setSnapTradeSyncing(false);
    }
  };

  const handleSnapTradeSync = async () => {
    if (logSync) logSync('finflow snaptrade sync --force', 'cmd');
    setSnapTradeSyncing(true);
    setSnapTradeMessage({ type: 'info', text: 'Refreshing investments holdings (cache TTL 24h)...' });
    try {
      await loadSnapTradeData({ force: true });
      setSnapTradeMessage({ type: 'success', text: 'SnapTrade investments synced successfully!' });
    } catch (err) {
      if (logSync) logSync('Holdings sync refresh failed', 'error', err.message);
      setSnapTradeMessage({ type: 'error', text: `Sync failed: ${err.message}` });
    } finally {
      setSnapTradeSyncing(false);
    }
  };

  const handleSaveKeys = async (e) => {
    e.preventDefault();
    if (logSync) logSync('finflow snaptrade setup --init', 'cmd');
    if (!clientId.trim() || !consumerKey.trim()) {
      if (logSync) logSync('Validation failed: client_id and consumer_key are required', 'error');
      setSnapTradeMessage({ type: 'error', text: 'Both Client ID and Consumer Key are required' });
      return;
    }
    setIsSavingKeys(true);
    setSnapTradeMessage({ type: 'info', text: 'Initializing SnapTrade client on backend...' });
    try {
      const configUrl = getSnapTradeUrl('api/snaptrade/config');
      const response = await fetch(configUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          clientId: clientId.trim(), 
          consumerKey: consumerKey.trim(),
          userId: userIdInput.trim()
        })
      });
      const data = await response.json();
      if (response.ok && data.success) {
        safeStorage.setItem('finflow_snaptrade_client_id', clientId.trim());
        safeStorage.setItem('finflow_snaptrade_consumer_key', consumerKey.trim());
        if (data.userId) {
          safeStorage.setItem('finflow_snaptrade_user_id', data.userId);
          setUserIdInput(data.userId);
        }
        if (data.userSecret) {
          safeStorage.setItem('finflow_snaptrade_user_secret', data.userSecret);
        }
        if (logSync) logSync('SnapTrade keys registered and user initialized successfully', 'success', `userId: ${data.userId}`);
        setSnapTradeMessage({ type: 'success', text: 'SnapTrade credentials saved and initialized successfully!' });
        await loadSnapTradeData();
      } else {
        throw new Error(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      if (logSync) logSync('Setup failed', 'error', err.message);
      setSnapTradeMessage({ type: 'error', text: `Failed to save credentials: ${err.message}` });
    } finally {
      setIsSavingKeys(false);
    }
  };

  const handleResetUserSession = () => {
    safeStorage.removeItem('finflow_snaptrade_user_id');
    safeStorage.removeItem('finflow_snaptrade_user_secret');
    setUserIdInput('');
    setSnapTradeMessage({ type: 'success', text: 'User session reset. Click "Save & Initialize Keys" to register a new user ID.' });
    loadSnapTradeData().catch(() => {});
  };

  const handleSnapTradeDisconnect = async () => {
    setSnapTradeSyncing(true);
    setSnapTradeMessage({ type: 'info', text: 'Disconnecting SnapTrade connection...' });
    try {
      const url = getSnapTradeUrl('api/snaptrade/disconnect');
      const response = await fetch(url, { 
        method: 'POST',
        headers: getSnapTradeHeaders()
      });
      if (!response.ok) throw new Error('Failed to disconnect');
      const result = await response.json();
      if (result.success) {
        safeStorage.removeItem('finflow_snaptrade_client_id');
        safeStorage.removeItem('finflow_snaptrade_consumer_key');
        safeStorage.removeItem('finflow_snaptrade_user_id');
        safeStorage.removeItem('finflow_snaptrade_user_secret');
        setClientId('');
        setConsumerKey('');
        setSnapTradeMessage({ type: 'success', text: 'SnapTrade connection removed successfully.' });
        await loadSnapTradeData();
      } else {
        throw new Error(result.error || 'Failed to disconnect');
      }
    } catch (err) {
      setSnapTradeMessage({ type: 'error', text: `Disconnect failed: ${err.message}` });
    } finally {
      setSnapTradeSyncing(false);
    }
  };

  const handleRemoveConnection = async (authorizationId) => {
    setSnapTradeSyncing(true);
    setSnapTradeMessage({ type: 'info', text: 'Removing brokerage connection...' });
    try {
      const url = getSnapTradeUrl('api/snaptrade/disconnect');
      const response = await fetch(url, {
        method: 'POST',
        headers: getSnapTradeHeaders(),
        body: JSON.stringify({ authorizationId })
      });
      if (!response.ok) throw new Error('Failed to remove connection');
      const result = await response.json();
      if (result.success) {
        setSnapTradeMessage({ type: 'success', text: 'Brokerage connection removed successfully.' });
        await loadSnapTradeData();
      } else {
        throw new Error(result.error || 'Failed to remove connection');
      }
    } catch (err) {
      setSnapTradeMessage({ type: 'error', text: `Remove connection failed: ${err.message}` });
    } finally {
      setSnapTradeSyncing(false);
    }
  };

  return (
    <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
      <div className="space-y-4">
        <div className="flex items-center space-x-3 mb-2">
          <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
            <CreditCard size={20} />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Brokerage Connections (SnapTrade)</h3>
            <p className="text-xs text-slate-500">Automate your investments and holdings synchronization.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2 bg-obsidian-800/40 p-4 rounded-xl border border-obsidian-850">
            <span className="text-xs font-bold text-slate-300 block">SnapTrade Credentials</span>
            <div className="space-y-2">
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="e.g. finflow-prod"
                  className="w-full bg-obsidian-950/80 border border-obsidian-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-neon-indigo/50 font-mono"
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Consumer Key</label>
                <input
                  type="password"
                  value={consumerKey}
                  onChange={(e) => setConsumerKey(e.target.value)}
                  placeholder="••••••••••••••••••••••••••••••••"
                  className="w-full bg-obsidian-950/80 border border-obsidian-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-neon-indigo/50 font-mono"
                />
              </div>

              {/* Advanced settings toggle */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSnapTrade(!showAdvancedSnapTrade)}
                  className="text-[9px] font-bold text-slate-500 hover:text-slate-350 transition-colors uppercase tracking-wider cursor-pointer focus:outline-none"
                >
                  {showAdvancedSnapTrade ? 'Hide Advanced' : 'Show Advanced (User ID)'}
                </button>
              </div>

              {showAdvancedSnapTrade && (
                <div className="space-y-2 pt-2 border-t border-obsidian-800/40">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">SnapTrade User ID (Optional)</label>
                    <input
                      type="text"
                      value={userIdInput}
                      onChange={(e) => setUserIdInput(e.target.value)}
                      placeholder="Paste existing User ID to reuse connection"
                      className="w-full bg-obsidian-950/80 border border-obsidian-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-neon-indigo/50 font-mono"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleResetUserSession}
                    className="w-full mt-1 py-1 bg-neon-crimson/10 hover:bg-neon-crimson/20 border border-neon-crimson/25 text-neon-crimson text-[10px] font-bold rounded-lg transition-colors cursor-pointer focus:outline-none"
                  >
                    Reset / Clear Local User Session
                  </button>
                </div>
              )}
              <button
                onClick={handleSaveKeys}
                disabled={isSavingKeys || snapTradeSyncing}
                className="w-full mt-1 py-1.5 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1 focus:outline-none"
              >
                <KeyRound size={12} />
                <span>{isSavingKeys ? 'Initializing...' : 'Save & Initialize Keys'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between bg-obsidian-800/40 p-3 rounded-xl border border-obsidian-850">
            <span className="text-xs font-semibold text-slate-300">Connection Status</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              snapTradeStatus.connected 
                ? 'bg-neon-emerald/15 text-neon-emerald border-neon-emerald/25' 
                : 'bg-slate-500/10 text-slate-400 border-slate-700/25'
            }`}>
              {snapTradeStatus.connected ? `${snapTradeStatus.connections?.length || 0} Linked` : 'Disconnected'}
            </span>
          </div>

          {snapTradeStatus.connected && snapTradeStatus.connections && snapTradeStatus.connections.length > 0 && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Linked Institutions</span>
              {snapTradeStatus.connections.map((conn) => (
                <div key={conn.item_id} className="bg-obsidian-900/45 p-3 rounded-xl border border-obsidian-850 text-xs flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="text-white font-medium block">{conn.institution_name}</span>
                    <span className="text-slate-500 block text-[9px] font-semibold">
                      {conn.account_count || 0} account{conn.account_count === 1 ? '' : 's'}
                    </span>
                    {conn.last_sync && (
                      <span className="text-slate-400 block text-[9px] font-mono">
                        Last synced: {new Date(conn.last_sync).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveConnection(conn.item_id)}
                    disabled={snapTradeSyncing}
                    className="p-1.5 bg-neon-crimson/10 hover:bg-neon-crimson/20 border border-neon-crimson/25 rounded-lg text-neon-crimson transition-colors cursor-pointer focus:outline-none"
                    title="Disconnect Connection"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <button
                onClick={handleSnapTradeDisconnect}
                disabled={snapTradeSyncing}
                className="w-full mt-2 py-2 bg-neon-crimson/10 hover:bg-neon-crimson/20 border border-neon-crimson/25 rounded-xl text-neon-crimson text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-2 focus:outline-none"
              >
                <Trash2 size={12} />
                <span>Disconnect All & Reset Keys</span>
              </button>
            </div>
          )}

          {snapTradeMessage && (
            <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
              snapTradeMessage.type === 'success' 
                ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                : snapTradeMessage.type === 'error'
                  ? 'bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson'
                  : 'bg-obsidian-850 border-obsidian-750 text-slate-300'
            }`}>
              {snapTradeMessage.type === 'success' ? (
                <CheckCircle2 size={16} className="shrink-0 text-neon-emerald" />
              ) : snapTradeMessage.type === 'error' ? (
                <AlertTriangle size={16} className="shrink-0 text-neon-crimson" />
              ) : (
                <RefreshCw size={16} className="animate-spin shrink-0 text-neon-indigo" />
              )}
              <span>{snapTradeMessage.text}</span>
            </div>
          )}
        </div>
      </div>

      <div className="pt-6 border-t border-obsidian-800/40 flex justify-between space-x-3 items-center">
        {snapTradeStatus.connected && (
          <button
            onClick={handleSnapTradeSync}
            disabled={snapTradeSyncing}
            className="px-3.5 py-2 bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center space-x-2 cursor-pointer focus:outline-none"
          >
            <RefreshCw size={14} className={snapTradeSyncing ? 'animate-spin' : ''} />
            <span>Sync Now</span>
          </button>
        )}
        <button
          onClick={handleLinkAccount}
          disabled={snapTradeSyncing || !snapTradeStatus.configured}
          className="px-3.5 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2 ml-auto cursor-pointer focus:outline-none"
        >
          <Link size={14} />
          <span>Link Brokerage</span>
        </button>
      </div>
    </Card>
  );
}
