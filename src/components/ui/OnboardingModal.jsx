import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Link2, RefreshCw, CheckCircle2, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { useAppContext } from '../../context/AppContext';

export default function OnboardingModal() {
  const { isMockData, syncData, isSyncing, error } = useAppContext();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [apiUrl, setApiUrl] = useState('');
  const [syncSuccess, setSyncSuccess] = useState(false);
  const [syncAttempted, setSyncAttempted] = useState(false);

  useEffect(() => {
    // Show modal if using mock data and user hasn't seen it yet
    const hasSeen = localStorage.getItem('finflow_onboarding_seen');
    if (isMockData && !hasSeen) {
      setIsOpen(true);
    }
  }, [isMockData]);

  const handleClose = () => {
    localStorage.setItem('finflow_onboarding_seen', 'true');
    setIsOpen(false);
  };

  const handleSaveUrl = () => {
    if (!apiUrl.trim()) return;
    // Set API URL in local storage
    localStorage.setItem('finflow_google_script_url', apiUrl.trim());
    // Also update current active environment
    window.location.reload(); // Reloading initializes AppContext with the new API URL
  };

  const handleTestSync = async () => {
    setSyncAttempted(true);
    const success = await syncData();
    if (success) {
      setSyncSuccess(true);
      setTimeout(() => {
        handleClose();
      }, 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-obsidian-950/90 backdrop-blur-xl z-[90] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-lg bg-[#0B0E14] border border-obsidian-700/60 rounded-3xl p-6 md:p-8 space-y-6 shadow-2xl relative"
      >
        <button 
          onClick={handleClose}
          className="absolute top-5 right-5 p-2 rounded-xl bg-obsidian-800 border border-obsidian-750 text-slate-400 hover:text-white transition-colors"
        >
          <X size={16} />
        </button>

        {/* Step 1: Welcome */}
        {step === 1 && (
          <div className="space-y-5 text-center py-4">
            <div className="mx-auto w-14 h-14 bg-neon-indigo/10 rounded-2xl flex items-center justify-center border border-neon-indigo/20 text-neon-indigo">
              <Sparkles size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">Welcome to FinFlow</h2>
              <p className="text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
                Beautiful, premium financial insights powered directly by your personal Google Sheets & Tiller database.
              </p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 bg-neon-indigo hover:bg-neon-indigo-hover text-white rounded-2xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-neon-indigo/15"
            >
              <span>Connect Database</span>
              <ArrowRight size={16} />
            </button>
            <button 
              onClick={handleClose}
              className="text-xs text-slate-500 hover:text-slate-400 font-semibold uppercase tracking-wider block mx-auto"
            >
              Explore Demo Version First
            </button>
          </div>
        )}

        {/* Step 2: Input API Url */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="space-y-2">
              <div className="flex items-center space-x-2 text-neon-indigo">
                <Link2 size={20} />
                <h3 className="text-lg font-bold text-white">Paste Apps Script Web App URL</h3>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Provide your deployed Google Apps Script URL. FinFlow communicates only with this script, keeping all your raw financial data local and private.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Web App API URL</label>
              <input
                type="text"
                value={apiUrl}
                onChange={(e) => setApiUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="w-full bg-obsidian-950 border border-obsidian-750 px-4 py-3.5 rounded-xl outline-none text-sm text-white placeholder-slate-600 focus:border-neon-indigo/50 transition-colors"
              />
            </div>

            <div className="bg-obsidian-900 border border-obsidian-850 p-4 rounded-2xl text-[11px] text-slate-400 leading-relaxed">
              💡 Need help? Open the{' '}
              <a 
                href="https://github.com/TMTrevisan/finflow#readme" 
                target="_blank" 
                rel="noreferrer"
                className="text-neon-indigo font-bold hover:underline"
              >
                Setup Guide
              </a>{' '}
              to see how to copy and deploy the Google Apps Script script in less than 2 minutes.
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-3 bg-obsidian-800 hover:bg-obsidian-700 text-slate-300 rounded-xl font-bold text-sm transition-colors border border-obsidian-750"
              >
                Back
              </button>
              <button
                onClick={handleSaveUrl}
                disabled={!apiUrl.trim()}
                className="flex-1 py-3 bg-neon-indigo hover:bg-neon-indigo-hover disabled:opacity-40 disabled:hover:bg-neon-indigo text-white rounded-xl font-bold text-sm transition-colors shadow-lg shadow-neon-indigo/10"
              >
                Save & Connect
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Test Connection & Sync (Only reached if they configured an URL in settings, but we can allow triggering it in wizard if they reload) */}
      </motion.div>
    </div>
  );
}
