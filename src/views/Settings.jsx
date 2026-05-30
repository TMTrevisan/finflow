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
  KeyRound,
  Brain,
  Fingerprint,
  Bell,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '../components/ui/BottomSheet';


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
    isSyncing,
    useCalendarToday,
    setUseCalendarToday
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

  // Gemini API key state
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => {
    return localStorage.getItem('finflow_gemini_key') || '';
  });
  const [geminiMessage, setGeminiMessage] = useState(null);

  // Mobile and Modal states
  const [isMobile, setIsMobile] = useState(false);
  const [isModelSheetOpen, setIsModelSheetOpen] = useState(false);
  const [isConfirmingClearCache, setIsConfirmingClearCache] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsConfirmingClearCache(false);
      }
    };
    if (isConfirmingClearCache) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirmingClearCache]);


  // Biometrics state
  const [biometricsEnabled, setBiometricsEnabled] = useState(() => {
    return localStorage.getItem('finflow_biometrics_enabled') === 'true';
  });
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsMessage, setBiometricsMessage] = useState(null);

  // Notification state
  const [notificationStatus, setNotificationStatus] = useState(() => {
    return typeof Notification !== 'undefined' ? Notification.permission : 'default';
  });
  const [notificationMessage, setNotificationMessage] = useState(null);

  // Check if WebAuthn platform authenticator is available
  useEffect(() => {
    if (window.PublicKeyCredential) {
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setBiometricsSupported(available))
        .catch(() => setBiometricsSupported(false));
    }
  }, []);

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
      const previousUrl = localStorage.getItem('finflow_api_url');
      localStorage.setItem('finflow_api_url', apiUrlInput.trim());
      
      const success = await syncData();
      if (success) {
        setUrlMessage({ type: 'success', text: 'Connection verified! Your sheet is successfully connected.' });
      } else {
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
      localStorage.removeItem('finflow_passcode');
      setPasscodeEnabled(false);
      setPinInput('');
      setPasscodeMessage({ type: 'success', text: 'PIN Passcode disabled successfully.' });
    } else {
      if (pinInput.length !== 4 || isNaN(Number(pinInput))) {
        setPasscodeMessage({ type: 'error', text: 'Please enter a valid 4-digit numeric PIN.' });
        return;
      }
      localStorage.setItem('finflow_passcode', pinInput);
      setPasscodeEnabled(true);
      setPasscodeMessage({ type: 'success', text: `PIN Passcode configured! Next time you open the app, you will need this PIN.` });
    }
  };

  // Gemini AI model state
  const [geminiModel, setGeminiModel] = useState(() => {
    return localStorage.getItem('finflow_gemini_model') || 'gemini-2.5-flash-lite';
  });

  const handleSaveGeminiKey = () => {
    localStorage.setItem('finflow_gemini_model', geminiModel);
    if (geminiKeyInput.trim()) {
      localStorage.setItem('finflow_gemini_key', geminiKeyInput.trim());
      setGeminiMessage({ type: 'success', text: 'Gemini settings saved successfully!' });
    } else {
      localStorage.removeItem('finflow_gemini_key');
      setGeminiMessage({ type: 'info', text: 'Gemini API Key cleared.' });
    }
  };

  const handleToggleBiometrics = async () => {
    if (biometricsEnabled) {
      localStorage.removeItem('finflow_biometrics_enabled');
      setBiometricsEnabled(false);
      setBiometricsMessage({ type: 'success', text: 'Biometric unlock disabled.' });
      return;
    }

    try {
      setBiometricsMessage({ type: 'info', text: 'Confirming biometric registration...' });
      const id = Uint8Array.from("finflow-user", c => c.charCodeAt(0));
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: "FinFlow" },
          user: {
            id,
            name: "user@finflow",
            displayName: "FinFlow User"
          },
          pubKeyCredParams: [{ type: "public-key", alg: -7 }],
          authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
          },
          timeout: 60000
        }
      });

      localStorage.setItem('finflow_biometrics_enabled', 'true');
      setBiometricsEnabled(true);
      setBiometricsMessage({ type: 'success', text: 'Biometrics registered! You can now unlock with TouchID/FaceID.' });
    } catch (err) {
      console.error(err);
      setBiometricsMessage({ type: 'error', text: `Registration failed: ${err.message}` });
    }
  };

  const handleRequestNotifications = async () => {
    if (!('Notification' in window)) {
      setNotificationMessage({ type: 'error', text: 'Notifications not supported in this browser.' });
      return;
    }

    const res = await Notification.requestPermission();
    setNotificationStatus(res);
    if (res === 'granted') {
      setNotificationMessage({ type: 'success', text: 'Triage notifications allowed! New uncategorized items will alert you.' });
    } else {
      setNotificationMessage({ type: 'error', text: 'Permission denied. Clear block settings in your browser address bar to retry.' });
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
    <div className="space-y-6 max-w-4xl pb-12">
      <div className="flex flex-col space-y-1">
        <h1 className="text-3xl font-bold tracking-tight text-white font-display">Settings</h1>
        <p className="text-sm text-slate-400">Manage spreadsheet connections, security credentials, and local database cache settings.</p>
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

        {/* Period Anchoring Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Calendar size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Period Anchoring</h3>
                <p className="text-xs text-slate-500">Select how "this month" is defined for budgets and cash flow.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-start space-x-3 bg-obsidian-800/30 p-3 rounded-xl border border-obsidian-850 cursor-pointer select-none">
                <input
                  type="radio"
                  name="period-anchor"
                  checked={useCalendarToday}
                  onChange={() => setUseCalendarToday(true)}
                  className="mt-0.5 border-slate-700 text-neon-indigo focus:ring-neon-indigo bg-obsidian-800"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Use Calendar Month (Today)</span>
                  <span className="text-[10px] text-slate-400">Anchor dates around the actual current calendar date ({new Date().toLocaleDateString()}).</span>
                </div>
              </label>

              <label className="flex items-start space-x-3 bg-obsidian-800/30 p-3 rounded-xl border border-obsidian-850 cursor-pointer select-none">
                <input
                  type="radio"
                  name="period-anchor"
                  checked={!useCalendarToday}
                  onChange={() => setUseCalendarToday(false)}
                  className="mt-0.5 border-slate-700 text-neon-indigo focus:ring-neon-indigo bg-obsidian-800"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Use Latest Transaction Date</span>
                  <span className="text-[10px] text-slate-400">Anchor dates around the latest transaction in your sheets (best for stale data).</span>
                </div>
              </label>
            </div>
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

        {/* Gemini AI Settings Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Brain size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Gemini AI Assistant</h3>
                <p className="text-xs text-slate-500">Enable local AI financial insights and transaction analysis.</p>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Gemini API Key</span>
                <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Get Free Key</a>
              </label>
              <input 
                type="password" 
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">AI LLM Model</label>
              {isMobile ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsModelSheetOpen(true)}
                    className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs text-left focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow flex items-center justify-between"
                  >
                    <span>
                      {geminiModel === 'gemini-2.5-flash-lite' && 'Gemini 2.5 Flash Lite (Recommended)'}
                      {geminiModel === 'gemini-2.5-flash' && 'Gemini 2.5 Flash (Balanced)'}
                      {geminiModel === 'gemini-2.0-flash' && 'Gemini 2.0 Flash (Fast)'}
                      {geminiModel === 'gemini-flash-lite-latest' && 'Gemini Flash Lite Latest'}
                      {geminiModel === 'gemini-flash-latest' && 'Gemini Flash Latest'}
                    </span>
                    <span className="text-slate-500 text-[10px]">Tap to change</span>
                  </button>
                  <BottomSheet
                    isOpen={isModelSheetOpen}
                    onClose={() => setIsModelSheetOpen(false)}
                    title="Select AI LLM Model"
                  >
                    <div className="space-y-2">
                      {[
                        { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite (Recommended - Fast & Stable)' },
                        { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash (Balanced - Stable)' },
                        { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Fast)' },
                        { value: 'gemini-flash-lite-latest', label: 'Gemini Flash Lite Latest (Alias - Lowest Cost)' },
                        { value: 'gemini-flash-latest', label: 'Gemini Flash Latest (Alias - High Performance)' }
                      ].map((opt) => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => {
                            setGeminiModel(opt.value);
                            localStorage.setItem('finflow_gemini_model', opt.value);
                            setIsModelSheetOpen(false);
                          }}
                          className={`w-full text-left px-4 py-3.5 text-sm rounded-2xl transition-colors border ${
                            geminiModel === opt.value
                              ? 'bg-neon-indigo/20 text-neon-indigo font-medium border-neon-indigo/35'
                              : 'bg-obsidian-800 text-slate-350 hover:bg-obsidian-700 hover:text-white border-obsidian-750'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </BottomSheet>
                </>
              ) : (
                <select
                  value={geminiModel}
                  onChange={(e) => {
                    setGeminiModel(e.target.value);
                    localStorage.setItem('finflow_gemini_model', e.target.value);
                  }}
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow appearance-none"
                >
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Recommended - Fast & Stable)</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Balanced - Stable)</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash (Fast)</option>
                  <option value="gemini-flash-lite-latest">Gemini Flash Lite Latest (Alias - Lowest Cost)</option>
                  <option value="gemini-flash-latest">Gemini Flash Latest (Alias - High Performance)</option>
                </select>
              )}
            </div>


            {geminiMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                geminiMessage.type === 'success' 
                  ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                  : 'bg-obsidian-800 border-obsidian-750 text-slate-350'
              }`}>
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{geminiMessage.text}</span>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-obsidian-800/40 flex justify-end">
            <button
              onClick={handleSaveGeminiKey}
              className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors shadow-md"
            >
              Save Settings
            </button>
          </div>
        </Card>

        {/* Biometrics Protection Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Fingerprint size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Biometric Unlock</h3>
                <p className="text-xs text-slate-500">Secure the app using TouchID / FaceID WebAuthn.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between bg-obsidian-800/40 p-3 rounded-xl border border-obsidian-850">
                <span className="text-xs font-semibold text-slate-300">Biometrics Status</span>
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                  biometricsEnabled 
                    ? 'bg-neon-indigo/15 text-neon-indigo border-neon-indigo/25' 
                    : 'bg-slate-500/10 text-slate-400 border-slate-700/25'
                }`}>
                  {biometricsEnabled ? 'Biometrics Enabled' : 'Disabled'}
                </span>
              </div>
              
              {!biometricsSupported && (
                <div className="p-2.5 rounded-lg bg-neon-crimson/5 border border-neon-crimson/10 text-[10px] text-neon-crimson flex items-center space-x-1.5">
                  <AlertTriangle size={12} className="shrink-0" />
                  <span>FaceID/TouchID is only supported in secure HTTPS contexts or when hosted locally.</span>
                </div>
              )}
            </div>

            {biometricsMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                biometricsMessage.type === 'success' 
                  ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                  : biometricsMessage.type === 'info'
                    ? 'bg-obsidian-800 border-obsidian-750 text-slate-300'
                    : 'bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson'
              }`}>
                {biometricsMessage.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0" />
                ) : biometricsMessage.type === 'info' ? (
                  <RefreshCw size={16} className="animate-spin shrink-0" />
                ) : (
                  <AlertTriangle size={16} className="shrink-0" />
                )}
                <span>{biometricsMessage.text}</span>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-obsidian-800/40 flex justify-end">
            <button
              onClick={handleToggleBiometrics}
              disabled={!biometricsSupported}
              className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center space-x-2 ${
                biometricsEnabled 
                  ? 'bg-neon-crimson/20 hover:bg-neon-crimson/30 text-neon-crimson border border-neon-crimson/35'
                  : 'bg-neon-indigo hover:bg-neon-indigo-hover text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              <Fingerprint size={14} />
              <span>{biometricsEnabled ? 'Disable Biometrics' : 'Enable TouchID / FaceID'}</span>
            </button>
          </div>
        </Card>

        {/* PWA & Notifications Manager */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 md:col-span-2 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
              <Bell size={20} />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Push Notifications</h3>
              <p className="text-xs text-slate-500">Configure background sync notifications for new uncategorized transactions.</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-obsidian-800/40 border border-obsidian-850 rounded-2xl">
            <div>
              <p className="text-xs font-semibold text-slate-400">Triage Notification Permission</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5 capitalize">Permission Status: {notificationStatus}</p>
            </div>
            
            <button
              onClick={handleRequestNotifications}
              className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-all shadow-md"
            >
              Request Alerts Permission
            </button>
          </div>

          {notificationMessage && (
            <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
              notificationMessage.type === 'success' 
                ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                : 'bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson'
            }`}>
              <CheckCircle2 size={16} className="shrink-0" />
              <span>{notificationMessage.text}</span>
            </div>
          )}
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
                onClick={() => setIsConfirmingClearCache(true)}
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

      {/* Clear Cache Confirmation Dialog Modal */}
      <AnimatePresence>
        {isConfirmingClearCache && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmingClearCache(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-cache-title"
              className="relative bg-obsidian-900 border border-obsidian-750 rounded-3xl p-6 shadow-2xl max-w-md w-full overflow-hidden z-10 text-left"
            >
              <div className="flex items-center space-x-3 mb-4 text-neon-crimson">
                <AlertTriangle size={24} />
                <h3 id="clear-cache-title" className="text-lg font-bold text-white font-display">
                  Clear Cached Data?
                </h3>
              </div>
              
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                You are about to clear the offline sync database cache. This is a safe action, but please review what will be deleted versus what remains intact.
              </p>

              <div className="space-y-3 mb-6">
                {/* What is cleared */}
                <div className="bg-neon-crimson/5 border border-neon-crimson/15 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neon-crimson block mb-1">
                    Will Be Cleared
                  </span>
                  <ul className="text-slate-300 text-xs list-disc pl-4 space-y-1">
                    <li>Transactions cache ({transactionCount} records)</li>
                    <li>Balances &amp; categories ({balanceCount} accounts, {categoryCount} items)</li>
                    <li>Life optimization cache</li>
                    <li>Sync status metrics &amp; timestamps</li>
                  </ul>
                </div>

                {/* What remains */}
                <div className="bg-neon-indigo/5 border border-neon-indigo/15 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neon-indigo block mb-1">
                    Remains Safe &amp; Intact
                  </span>
                  <ul className="text-slate-300 text-xs list-disc pl-4 space-y-1">
                    <li>Google Apps Script Connection URL</li>
                    <li>Gemini AI API Key</li>
                    <li>PIN Shield &amp; Biometric settings</li>
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setIsConfirmingClearCache(false)}
                  className="px-4 py-2 bg-obsidian-800 border border-obsidian-750 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearCache();
                    setIsConfirmingClearCache(false);
                  }}
                  className="px-4 py-2 bg-neon-crimson hover:bg-neon-crimson-hover text-white text-xs font-bold rounded-xl transition-all shadow-md"
                >
                  Clear Cache
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
