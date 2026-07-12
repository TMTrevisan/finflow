import React, { useState } from 'react';
import { Card } from '../ui/Card';
import { Link, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export default function SheetsIntegrationCard({ syncData, loadData, isSyncing }) {
  const [apiUrlInput, setApiUrlInput] = useState(() => {
    return safeStorage.getItem('finflow_api_url') || '';
  });
  const [urlMessage, setUrlMessage] = useState(null);

  const handleSaveUrl = async () => {
    setUrlMessage({ type: 'info', text: 'Saving and validating connection...' });
    if (!apiUrlInput.trim()) {
      safeStorage.removeItem('finflow_api_url');
      setUrlMessage({ type: 'success', text: 'URL cleared. App will fall back to local .env or Mock Data.' });
      loadData(true);
      return;
    }

    try {
      const previousUrl = safeStorage.getItem('finflow_api_url');
      safeStorage.setItem('finflow_api_url', apiUrlInput.trim());
      
      const success = await syncData();
      if (success) {
        setUrlMessage({ type: 'success', text: 'Connection verified! Your sheet is successfully connected.' });
      } else {
        if (previousUrl) {
          safeStorage.setItem('finflow_api_url', previousUrl);
        } else {
          safeStorage.removeItem('finflow_api_url');
        }
        setUrlMessage({ type: 'error', text: 'Connection failed. Verify the URL is correct and Apps Script is deployed as "Anyone".' });
      }
    } catch (err) {
      setUrlMessage({ type: 'error', text: `Verification error: ${err.message}` });
    }
  };

  return (
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
          <label 
            htmlFor="settings-google-script-url"
            className="block text-xs font-bold text-slate-400 uppercase tracking-wider"
          >
            Apps Script Web App URL
          </label>
          <input 
            type="text" 
            id="settings-google-script-url"
            value={apiUrlInput}
            onChange={(e) => setApiUrlInput(e.target.value)}
            placeholder="https://script.google.com/macros/s/…/exec"
            autoComplete="off"
            spellCheck={false}
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
          className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors shadow-md disabled:opacity-50 cursor-pointer"
        >
          Verify & Connect Sheet
        </button>
      </div>
    </Card>
  );
}
