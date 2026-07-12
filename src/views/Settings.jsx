import React, { useState, useEffect, useMemo } from 'react';
import { useAppContext } from '../context/AppContext';
import { safeStorage } from '../utils/storage';
import { Card, CardContent } from '../components/ui/Card';
import { cleanMerchantName } from '../utils/formatting';
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
  Calendar,
  Sliders,
  CreditCard,
  Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { BottomSheet } from '../components/ui/BottomSheet';


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
    isMockData,
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

  // Sync Diagnostics state
  const [syncLogs, setSyncLogs] = useState([]);
  const [logsCopied, setLogsCopied] = useState(false);

  useEffect(() => {
    const loadLogs = () => {
      try {
        const stored = JSON.parse(safeStorage.getItem('finflow_sync_logs') || '[]');
        setSyncLogs(stored);
      } catch (e) {
        setSyncLogs([]);
      }
    };
    loadLogs();
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleCopyLogs = async () => {
    const text = syncLogs.length > 0 ? syncLogs.join('\n') : 'No diagnostic events logged yet.';
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setLogsCopied(true);
      setTimeout(() => setLogsCopied(false), 2000);
    } catch (err) {
      console.warn('Failed to copy sync logs:', err);
      setLogsCopied(false);
    }
  };

  // SnapTrade Integration state
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
    logSync('finflow snaptrade login --portal', 'cmd');
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
        logSync('Opening SnapTrade Connection Portal...', 'info', 'Portal URL generated');
        window.open(data.redirectURI, '_blank');
        
        // Wait a few seconds then check/poll status
        setTimeout(async () => {
          await loadSnapTradeData();
          setSnapTradeMessage({ type: 'success', text: 'Brokerage authentication portal opened. Click "Sync Now" if your account does not sync automatically.' });
        }, 3000);
      } else {
        throw new Error(data.error || 'Failed to get portal link');
      }
    } catch (err) {
      logSync('Generating connection portal link failed', 'error', err.message);
      setSnapTradeMessage({ type: 'error', text: `Failed to open connection portal: ${err.message}` });
    } finally {
      setSnapTradeSyncing(false);
    }
  };

  const handleSnapTradeSync = async () => {
    logSync('finflow snaptrade sync --force', 'cmd');
    setSnapTradeSyncing(true);
    setSnapTradeMessage({ type: 'info', text: 'Refreshing investments holdings (cache TTL 24h)...' });
    try {
      await loadSnapTradeData({ force: true });
      setSnapTradeMessage({ type: 'success', text: 'SnapTrade investments synced successfully!' });
    } catch (err) {
      logSync('Holdings sync refresh failed', 'error', err.message);
      setSnapTradeMessage({ type: 'error', text: `Sync failed: ${err.message}` });
    } finally {
      setSnapTradeSyncing(false);
    }
  };

  const handleSaveKeys = async (e) => {
    e.preventDefault();
    logSync('finflow snaptrade setup --init', 'cmd');
    if (!clientId.trim() || !consumerKey.trim()) {
      logSync('Validation failed: client_id and consumer_key are required', 'error');
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
        logSync('SnapTrade keys registered and user initialized successfully', 'success', `userId: ${data.userId}`);
        setSnapTradeMessage({ type: 'success', text: 'SnapTrade credentials saved and initialized successfully!' });
        await loadSnapTradeData();
      } else {
        throw new Error(data.error || 'Failed to save configuration');
      }
    } catch (err) {
      logSync('Setup failed', 'error', err.message);
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

  // URL state
  const [apiUrlInput, setApiUrlInput] = useState(() => {
    return safeStorage.getItem('finflow_api_url') || '';
  });
  const [urlMessage, setUrlMessage] = useState(null);

  // Passcode state
  const [passcodeEnabled, setPasscodeEnabled] = useState(() => {
    return !!safeStorage.getItem('finflow_passcode');
  });
  const [pinInput, setPinInput] = useState('');
  const [passcodeMessage, setPasscodeMessage] = useState(null);

  // Multi-Provider AI state
  const [aiProvider, setAiProvider] = useState(() => {
    return safeStorage.getItem('finflow_ai_provider') || 'gemini';
  });
  const [aiModel, setAiModel] = useState(() => {
    return safeStorage.getItem('finflow_ai_model') || 'gemini-2.5-flash-lite';
  });
  const [geminiKeyInput, setGeminiKeyInput] = useState(() => {
    return safeStorage.getItem('finflow_gemini_key') || '';
  });
  const [openaiKeyInput, setOpenaiKeyInput] = useState(() => {
    return safeStorage.getItem('finflow_openai_key') || '';
  });
  const [claudeKeyInput, setClaudeKeyInput] = useState(() => {
    return safeStorage.getItem('finflow_claude_key') || '';
  });
  const [deepseekKeyInput, setDeepseekKeyInput] = useState(() => {
    return safeStorage.getItem('finflow_deepseek_key') || '';
  });
  const [aiMessage, setAiMessage] = useState(null);

  // MCP Settings State
  const [mcpEnabled, setMcpEnabled] = useState(() => {
    return safeStorage.getItem('finflow_mcp_enabled') === 'true';
  });
  const [mcpUrlInput, setMcpUrlInput] = useState(() => {
    return safeStorage.getItem('finflow_mcp_url') || 'http://localhost:3001';
  });
  const [mcpSecretInput, setMcpSecretInput] = useState(() => {
    return safeStorage.getItem('finflow_mcp_secret') || 'test123';
  });
  const [mcpMessage, setMcpMessage] = useState(null);
  const [mcpToolsList, setMcpToolsList] = useState([]);

  // Fetch tools list on mount
  useEffect(() => {
    const enabled = safeStorage.getItem('finflow_mcp_enabled') === 'true';
    const url = (safeStorage.getItem('finflow_mcp_url') || '').trim().replace(/\/+$/, '');
    const secret = (safeStorage.getItem('finflow_mcp_secret') || '').trim();
    
    if (enabled && url) {
      const fetchToolsList = async () => {
        const requestUrl = secret 
          ? (url.endsWith(secret) ? `${url}/tools` : `${url}/${secret}/tools`)
          : `${url}/tools`;
        try {
          const response = await fetch(requestUrl, {
            headers: secret ? { 'Authorization': `Bearer ${secret}` } : {}
          });
          if (response.ok) {
            const data = await response.json();
            setMcpToolsList(data.tools || []);
          }
        } catch (e) {
          console.warn('[Settings] Failed to fetch tools list on mount:', e.message);
        }
      };
      fetchToolsList();
    }
  }, []);

  // Mobile and Modal states
  const [isMobile, setIsMobile] = useState(false);
  const [isModelSheetOpen, setIsModelSheetOpen] = useState(false);
  const [isConfirmingClearCache, setIsConfirmingClearCache] = useState(false);
  const [isConfirmingClearSnapTradeCache, setIsConfirmingClearSnapTradeCache] = useState(false);

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
        setIsConfirmingClearSnapTradeCache(false);
      }
    };
    if (isConfirmingClearCache || isConfirmingClearSnapTradeCache) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isConfirmingClearCache, isConfirmingClearSnapTradeCache]);


  // Biometrics state
  const [biometricsEnabled, setBiometricsEnabled] = useState(() => {
    return safeStorage.getItem('finflow_biometrics_enabled') === 'true';
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

  const uniqueMerchantsCount = useMemo(() => {
    const merchants = new Set(transactions.map(t => cleanMerchantName(t.description)).filter(Boolean));
    return merchants.size;
  }, [transactions]);

  const institutionAccountCount = useMemo(() => {
    const latestMap = new Map();
    const sorted = [...(balances || [])]
      .filter(b => b && b.date && b.institution && b.account)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    sorted.forEach(b => {
      const key = `${b.institution}_${b.account}_${b.account_id || ''}`;
      latestMap.set(key, b);
    });
    return Array.from(latestMap.values()).length;
  }, [balances]);
  
  const cacheSizeEstimate = useMemo(() => {
    let charCount = 0;
    try {
      charCount += (safeStorage.getItem('finflow_cache_transactions') || '').length;
      charCount += (safeStorage.getItem('finflow_cache_categories') || '').length;
      charCount += (safeStorage.getItem('finflow_cache_balances') || '').length;
    } catch (e) {}
    // Estimate bytes (utf-16 characters = 2 bytes)
    const kb = (charCount * 2) / 1024;
    return kb.toFixed(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, categories, balances]);

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

  const handleTogglePasscode = async () => {
    const isCurrentlyEnabled = !!safeStorage.getItem('finflow_passcode');
    if (isCurrentlyEnabled) {
      safeStorage.removeItem('finflow_passcode');
      setPasscodeEnabled(false);
      setPinInput('');
      setPasscodeMessage({ type: 'success', text: 'PIN Passcode disabled successfully.' });
    } else {
      if (pinInput.length !== 4 || isNaN(Number(pinInput))) {
        setPasscodeMessage({ type: 'error', text: 'Please enter a valid 4-digit numeric PIN.' });
        return;
      }
      try {
        const msgBuffer = new TextEncoder().encode(pinInput);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashedPIN = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        
        safeStorage.setItem('finflow_passcode', hashedPIN);
        setPasscodeEnabled(true);
        setPasscodeMessage({ type: 'success', text: `PIN Passcode configured securely! Next time you open the app, you will need this PIN.` });
      } catch (err) {
        setPasscodeMessage({ type: 'error', text: `Passcode configuration failed: ${err.message}` });
      }
    }
  };

  const handleSaveAiSettings = async () => {
    setAiMessage({ type: 'info', text: 'Validating API key connection...' });
    
    const provider = aiProvider;
    const model = aiModel;
    const geminiKey = geminiKeyInput.trim();
    const openaiKey = openaiKeyInput.trim();
    const claudeKey = claudeKeyInput.trim();
    const deepseekKey = deepseekKeyInput.trim();
    const mcpUrl = mcpUrlInput.trim().replace(/\/+$/, '');
    const mcpSecret = mcpSecretInput.trim();
    
    let keyToTest = '';
    if (provider === 'gemini') keyToTest = geminiKey;
    else if (provider === 'openai') keyToTest = openaiKey;
    else if (provider === 'claude') keyToTest = claudeKey;
    else if (provider === 'deepseek') keyToTest = deepseekKey;

    if (!keyToTest) {
      saveKeys();
      setAiMessage({ type: 'success', text: 'AI configuration saved (no key provided to validate).' });
      return;
    }

    try {
      if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:countTokens?key=${keyToTest}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'test' }] }] })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error?.message || `Status ${res.status}`);
        }
      } else {
        const proxyUrl = mcpEnabled && mcpUrl
          ? (mcpSecret ? (mcpUrl.endsWith(mcpSecret) ? `${mcpUrl}/proxy` : `${mcpUrl}/${mcpSecret}/proxy`) : `${mcpUrl}/proxy`)
          : null;
        
        let testUrl = '';
        let testHeaders = { 'Content-Type': 'application/json' };
        let testBody = null;
        
        if (provider === 'openai') {
          testUrl = 'https://api.openai.com/v1/models';
          testHeaders['Authorization'] = `Bearer ${keyToTest}`;
        } else if (provider === 'deepseek') {
          testUrl = 'https://api.deepseek.com/v1/models';
          testHeaders['Authorization'] = `Bearer ${keyToTest}`;
        } else if (provider === 'claude') {
          testUrl = 'https://api.anthropic.com/v1/messages';
          testHeaders['x-api-key'] = keyToTest;
          testHeaders['anthropic-version'] = '2023-06-01';
          testHeaders['anthropic-dangerous-direct-browser-access'] = 'true';
          testBody = JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'hello' }]
          });
        }
        
        let res;
        if (proxyUrl) {
          res = await fetch(proxyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(mcpSecret ? { 'Authorization': `Bearer ${mcpSecret}` } : {})
            },
            body: JSON.stringify({
              url: testUrl,
              headers: testHeaders,
              method: testBody ? 'POST' : 'GET',
              body: testBody
            })
          });
        } else {
          res = await fetch(testUrl, {
            method: testBody ? 'POST' : 'GET',
            headers: testHeaders,
            body: testBody
          });
        }
        
        if (!res.ok) {
          throw new Error(`Verification request failed with status ${res.status}`);
        }
      }

      saveKeys();
      setAiMessage({ type: 'success', text: `AI configuration and ${provider} API key verified successfully!` });
    } catch (err) {
      setAiMessage({
        type: 'error',
        text: `API Key verification failed: ${err.message}. Ensure the key is correct and valid.`
      });
    }

    function saveKeys() {
      safeStorage.setItem('finflow_ai_provider', provider);
      safeStorage.setItem('finflow_ai_model', model);

      if (geminiKey) safeStorage.setItem('finflow_gemini_key', geminiKey);
      else safeStorage.removeItem('finflow_gemini_key');

      if (openaiKey) safeStorage.setItem('finflow_openai_key', openaiKey);
      else safeStorage.removeItem('finflow_openai_key');

      if (claudeKey) safeStorage.setItem('finflow_claude_key', claudeKey);
      else safeStorage.removeItem('finflow_claude_key');

      if (deepseekKey) safeStorage.setItem('finflow_deepseek_key', deepseekKey);
      else safeStorage.removeItem('finflow_deepseek_key');
    }
  };

  const handleSaveMcpSettings = async () => {
    setMcpMessage({ type: 'info', text: 'Validating MCP Server connection parameters...' });
    
    const url = mcpUrlInput.trim().replace(/\/+$/, '');
    const secret = mcpSecretInput.trim();

    if (!mcpEnabled) {
      safeStorage.setItem('finflow_mcp_enabled', 'false');
      safeStorage.setItem('finflow_mcp_url', url);
      safeStorage.setItem('finflow_mcp_secret', secret);
      setMcpMessage({ type: 'success', text: 'MCP Support disabled successfully.' });
      return;
    }

    const controller = new AbortController();
    const warnTimeoutId = setTimeout(() => {
      setMcpMessage({ type: 'info', text: 'MCP Server is cold-starting (waking up Render instance). This can take up to 50 seconds. Please wait...' });
    }, 4000);
    const abortTimeoutId = setTimeout(() => {
      controller.abort();
    }, 50000);

    const requestUrl = secret 
      ? (url.endsWith(secret) ? `${url}/tools` : `${url}/${secret}/tools`)
      : `${url}/tools`;

    try {
      const response = await fetch(requestUrl, {
        signal: controller.signal,
        headers: secret ? { 'Authorization': `Bearer ${secret}` } : {}
      });
      clearTimeout(warnTimeoutId);
      clearTimeout(abortTimeoutId);

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status} (${response.statusText || 'Unauthorized/Not Found'})`);
      }

      const data = await response.json();
      const toolsCount = data.tools ? data.tools.length : 0;
      setMcpToolsList(data.tools || []);

      safeStorage.setItem('finflow_mcp_enabled', 'true');
      safeStorage.setItem('finflow_mcp_url', url);
      safeStorage.setItem('finflow_mcp_secret', secret);
      
      setMcpMessage({
        type: 'success',
        text: `Connection verified! MCP Server active with ${toolsCount} tools loaded.`
      });
      
      // Auto-reload window to apply connection changes across context
      setTimeout(() => window.location.reload(), 1500);

    } catch (err) {
      clearTimeout(warnTimeoutId);
      clearTimeout(abortTimeoutId);
      setMcpMessage({
        type: 'error',
        text: `Connection verification failed: ${err.message}. Please check your URL, secret token, and ensure the Render web service is awake.`
      });
    }
  };

  const handleToggleBiometrics = async () => {
    if (biometricsEnabled) {
      safeStorage.removeItem('finflow_biometrics_enabled');
      safeStorage.removeItem('finflow_biometric_cred_id');
      setBiometricsEnabled(false);
      setBiometricsMessage({ type: 'success', text: 'Biometric unlock disabled.' });
      return;
    }

    try {
      setBiometricsMessage({ type: 'info', text: 'Confirming biometric registration...' });
      const id = Uint8Array.from("finflow-user", c => c.charCodeAt(0));
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      
      const credential = await navigator.credentials.create({
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

      if (credential) {
        const bin = String.fromCharCode(...new Uint8Array(credential.rawId));
        const credIdBase64 = window.btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
        safeStorage.setItem('finflow_biometric_cred_id', credIdBase64);
        safeStorage.setItem('finflow_biometrics_enabled', 'true');
        setBiometricsEnabled(true);
        setBiometricsMessage({ type: 'success', text: 'Biometrics registered securely! You can now unlock with TouchID/FaceID.' });
      }
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

        {/* Custom Splits Settings Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Advanced Features</h3>
                <p className="text-xs text-slate-500">Toggle personalized views and custom splitting configurations.</p>
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start space-x-3 bg-obsidian-800/30 p-3 rounded-xl border border-obsidian-850 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={enableCustomSplits}
                  onChange={(e) => setEnableCustomSplits(e.target.checked)}
                  className="mt-1 border-slate-700 rounded text-neon-indigo focus:ring-neon-indigo bg-obsidian-800"
                />
                <div>
                  <span className="text-xs font-bold text-white block">Custom Income Split Mode</span>
                  <span className="text-[10px] text-slate-400">
                    Enable specific calculations, custom payroll merchant cleanup, and the Contributions & Surplus planning dashboard.
                  </span>
                </div>
              </label>

              {/* Partner configuration inputs */}
              <div className="border-t border-obsidian-800 pt-3 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Custom Label Settings</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner A Name</label>
                    <input
                      type="text"
                      value={partnerAName}
                      placeholder={enableCustomSplits ? 'Kaitlyn' : 'Wife'}
                      onChange={(e) => setPartnerAName(e.target.value)}
                      className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner B Name</label>
                    <input
                      type="text"
                      value={partnerBName}
                      placeholder={enableCustomSplits ? 'Todd' : 'Husband'}
                      onChange={(e) => setPartnerBName(e.target.value)}
                      className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner A Employer / Tag</label>
                    <input
                      type="text"
                      value={partnerAEmployer}
                      placeholder={enableCustomSplits ? 'Havas' : 'Employer A'}
                      onChange={(e) => setPartnerAEmployer(e.target.value)}
                      className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 font-bold block mb-1">Partner B Employer / Tag</label>
                    <input
                      type="text"
                      value={partnerBEmployer}
                      placeholder={enableCustomSplits ? 'BD' : 'Employer B'}
                      onChange={(e) => setPartnerBEmployer(e.target.value)}
                      className="w-full bg-obsidian-850 border border-obsidian-750 text-white rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50"
                    />
                  </div>
                </div>
              </div>
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

        {/* Unified Copilot AI Settings Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Brain size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Copilot Core LLM</h3>
                <p className="text-xs text-slate-500">Configure your primary AI provider and models.</p>
              </div>
            </div>

            {/* Provider Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">AI Provider</label>
              <select
                value={aiProvider}
                onChange={(e) => {
                  const prov = e.target.value;
                  setAiProvider(prov);
                  safeStorage.setItem('finflow_ai_provider', prov);
                  // Set sensible default model
                  let defaultModel = 'gemini-2.5-flash-lite';
                  if (prov === 'openai') defaultModel = 'gpt-4o-mini';
                  else if (prov === 'claude') defaultModel = 'claude-3-5-sonnet-latest';
                  else if (prov === 'deepseek') defaultModel = 'deepseek-v4-flash';
                  setAiModel(defaultModel);
                  safeStorage.setItem('finflow_ai_model', defaultModel);
                }}
                className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow appearance-none"
              >
                <option value="gemini">Google Gemini</option>
                <option value="openai">OpenAI (ChatGPT)</option>
                <option value="claude">Anthropic Claude</option>
                <option value="deepseek">DeepSeek</option>
              </select>
            </div>

            {/* Model Selector */}
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Model</label>
              <select
                value={aiModel}
                onChange={(e) => {
                  setAiModel(e.target.value);
                  safeStorage.setItem('finflow_ai_model', e.target.value);
                }}
                className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow appearance-none"
              >
                {aiProvider === 'gemini' && (
                  <>
                    <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Recommended)</option>
                    <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                    <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                    <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                  </>
                )}
                {aiProvider === 'openai' && (
                  <>
                    <option value="gpt-4o-mini">gpt-4o-mini (Fast & Cost-Efficient)</option>
                    <option value="gpt-4o">gpt-4o (High Intelligence)</option>
                    <option value="o1-mini">o1-mini (Reasoning)</option>
                  </>
                )}
                {aiProvider === 'claude' && (
                  <>
                    <option value="claude-3-5-sonnet-latest">Claude 3.5 Sonnet (State of the Art)</option>
                    <option value="claude-3-5-haiku-latest">Claude 3.5 Haiku (Fast & Precise)</option>
                    <option value="claude-3-opus-latest">Claude 3 Opus (Complex Analysis)</option>
                  </>
                )}
                {aiProvider === 'deepseek' && (
                  <>
                    <option value="deepseek-v4-flash">deepseek-v4-flash (Recommended - Fast & Cost-Efficient)</option>
                    <option value="deepseek-v4-pro">deepseek-v4-pro (High Intelligence)</option>
                    <option value="deepseek-chat">deepseek-chat (DeepSeek-V3 Legacy)</option>
                    <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1)</option>
                  </>
                )}
              </select>
            </div>

            {/* Dynamic API Key input based on chosen provider */}
            {aiProvider === 'gemini' && (
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
            )}

            {aiProvider === 'openai' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>OpenAI API Key</span>
                  <a href="https://platform.openai.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Platform Dashboard</a>
                </label>
                <input 
                  type="password" 
                  value={openaiKeyInput}
                  onChange={(e) => setOpenaiKeyInput(e.target.value)}
                  placeholder="sk-proj-..."
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
                />
              </div>
            )}

            {aiProvider === 'claude' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>Anthropic API Key</span>
                  <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Console Dashboard</a>
                </label>
                <input 
                  type="password" 
                  value={claudeKeyInput}
                  onChange={(e) => setClaudeKeyInput(e.target.value)}
                  placeholder="sk-ant-..."
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
                />
              </div>
            )}

            {aiProvider === 'deepseek' && (
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                  <span>DeepSeek API Key</span>
                  <a href="https://platform.deepseek.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Developer Platform</a>
                </label>
                <input 
                  type="password" 
                  value={deepseekKeyInput}
                  onChange={(e) => setDeepseekKeyInput(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
                />
              </div>
            )}

            {aiMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                aiMessage.type === 'success' 
                  ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                  : 'bg-obsidian-800 border-obsidian-750 text-slate-350'
              }`}>
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{aiMessage.text}</span>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-obsidian-800/40 flex justify-end">
            <button
              onClick={handleSaveAiSettings}
              className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors shadow-md"
            >
              Save AI Settings
            </button>
          </div>
        </Card>

        {/* Model Context Protocol (MCP) Integration Settings Card */}
        <Card className="bg-obsidian-800/40 border-obsidian-800/80 p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center space-x-3 mb-2">
              <div className="p-2 bg-neon-indigo/10 rounded-xl text-neon-indigo">
                <Link size={20} />
              </div>
              <div>
                <h3 className="font-bold text-white text-base">Model Context Protocol</h3>
                <p className="text-xs text-slate-500">Enable local/remote MCP tools for agentic transaction queries.</p>
              </div>
            </div>

            {/* MCP Toggle */}
            <div className="flex items-center justify-between bg-obsidian-800/40 p-3 rounded-xl border border-obsidian-850">
              <div>
                <span className="text-xs font-bold text-white block">Enable MCP Support</span>
                <span className="text-[10px] text-slate-400">Allows Copilot to invoke local data retrieval tools dynamically.</span>
              </div>
              <input
                type="checkbox"
                checked={mcpEnabled}
                onChange={(e) => setMcpEnabled(e.target.checked)}
                className="rounded border-slate-700 text-neon-indigo focus:ring-neon-indigo bg-obsidian-800 w-4 h-4 cursor-pointer"
              />
            </div>

            {mcpEnabled && (
              <>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">MCP Server URL</label>
                  <input 
                    type="text" 
                    value={mcpUrlInput}
                    onChange={(e) => setMcpUrlInput(e.target.value)}
                    placeholder="http://localhost:3001"
                    className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
                  />
                </div>

                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">MCP Auth Secret / Bearer Token</label>
                  <input 
                    type="password" 
                    value={mcpSecretInput}
                    onChange={(e) => setMcpSecretInput(e.target.value)}
                    placeholder="Auth Token..."
                    className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
                  />
                </div>
              </>
            )}

            {mcpMessage && (
              <div className={`p-3 rounded-xl border text-xs flex items-start space-x-2 ${
                mcpMessage.type === 'success' 
                  ? 'bg-neon-emerald/10 border-neon-emerald/20 text-neon-emerald'
                  : mcpMessage.type === 'error'
                    ? 'bg-neon-crimson/10 border-neon-crimson/20 text-neon-crimson'
                    : 'bg-obsidian-850 border-obsidian-750 text-slate-300'
              }`}>
                {mcpMessage.type === 'success' ? (
                  <CheckCircle2 size={16} className="shrink-0 text-neon-emerald" />
                ) : mcpMessage.type === 'error' ? (
                  <AlertTriangle size={16} className="shrink-0 text-neon-crimson" />
                ) : (
                  <RefreshCw size={16} className="animate-spin shrink-0 text-neon-indigo" />
                )}
                <span>{mcpMessage.text}</span>
              </div>
            )}

            {mcpEnabled && mcpToolsList.length > 0 && (
              <div className="space-y-2 mt-4 pt-4 border-t border-obsidian-800/60">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Loaded Database Tools ({mcpToolsList.length})
                </h4>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-1 scrollbar-thin">
                  {mcpToolsList.map((tool) => (
                    <div 
                      key={tool.name} 
                      className="p-3 bg-obsidian-900/50 border border-obsidian-800/80 rounded-xl hover:bg-obsidian-900/80 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-neon-emerald">{tool.name}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-obsidian-800 text-slate-400 font-semibold uppercase">
                          {tool.inputSchema?.properties ? `${Object.keys(tool.inputSchema.properties).length} params` : '0 params'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 leading-normal">{tool.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="pt-6 border-t border-obsidian-800/40 flex justify-end">
            <button
              onClick={handleSaveMcpSettings}
              className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors shadow-md"
            >
              Save MCP Settings
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

        {/* SnapTrade Integration Card */}
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
                      className="text-[9px] font-bold text-slate-500 hover:text-slate-350 transition-colors uppercase tracking-wider"
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
                        className="w-full mt-1 py-1 bg-neon-crimson/10 hover:bg-neon-crimson/20 border border-neon-crimson/25 text-neon-crimson text-[10px] font-bold rounded-lg transition-colors cursor-pointer"
                      >
                        Reset / Clear Local User Session
                      </button>
                    </div>
                  )}
                  <button
                    onClick={handleSaveKeys}
                    disabled={isSavingKeys || snapTradeSyncing}
                    className="w-full mt-1 py-1.5 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-[11px] font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center space-x-1"
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
                        className="p-1.5 bg-neon-crimson/10 hover:bg-neon-crimson/20 border border-neon-crimson/25 rounded-lg text-neon-crimson transition-colors cursor-pointer"
                        title="Disconnect Connection"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={handleSnapTradeDisconnect}
                    disabled={snapTradeSyncing}
                    className="w-full mt-2 py-2 bg-neon-crimson/10 hover:bg-neon-crimson/20 border border-neon-crimson/25 rounded-xl text-neon-crimson text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-2"
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
                className="px-3.5 py-2 bg-obsidian-800 hover:bg-obsidian-750 border border-obsidian-700 text-white text-xs font-bold rounded-xl transition-colors flex items-center space-x-2 cursor-pointer"
              >
                <RefreshCw size={14} className={snapTradeSyncing ? 'animate-spin' : ''} />
                <span>Sync Now</span>
              </button>
            )}
            <button
              onClick={handleLinkAccount}
              disabled={snapTradeSyncing || !snapTradeStatus.configured}
              className="px-3.5 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center space-x-2 ml-auto cursor-pointer"
            >
              <Link size={14} />
              <span>Link Brokerage</span>
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

          {/* Stats Section */}
          <div className="space-y-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">Google Sheets Cache Database</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Transactions</span>
                  <span className="text-xl font-bold text-white">{transactionCount} rows</span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Categories</span>
                  <span className="text-xl font-bold text-white">{categoryCount} items</span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Merchants</span>
                  <span className="text-xl font-bold text-white">{uniqueMerchantsCount} items</span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inst. Accounts</span>
                  <span className="text-xl font-bold text-white">{institutionAccountCount} accounts</span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cache Size</span>
                  <span className="text-xl font-bold text-white">{cacheSizeEstimate} KB</span>
                </div>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-2">SnapTrade Brokerage Cache Database</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Brokerage Connections</span>
                  <span className="text-xl font-bold text-white">{snapTradeStatus.connections?.length || 0} links</span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Sync Accounts</span>
                  <span className="text-xl font-bold text-white">{snapTradeHoldings?.accounts?.length || 0} accounts</span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Equity Positions</span>
                  <span className="text-xl font-bold text-white">
                    {snapTradeHoldings?.positions?.filter(p => p.symbol?.symbol !== 'CASH' && p.assetClass !== 'Alternatives (Options)')?.length || 0} items
                  </span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Option Positions</span>
                  <span className="text-xl font-bold text-white">
                    {snapTradeHoldings?.positions?.filter(p => p.assetClass === 'Alternatives (Options)')?.length || 0} items
                  </span>
                </div>
                <div className="bg-obsidian-800/30 border border-obsidian-800/80 p-4 rounded-2xl flex flex-col justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cash Entries</span>
                  <span className="text-xl font-bold text-white">
                    {snapTradeHoldings?.positions?.filter(p => p.symbol?.symbol === 'CASH')?.length || 0} items
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Last Sync */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-obsidian-800/40 border border-obsidian-850 rounded-2xl">
            <div>
              <p className="text-xs font-semibold text-slate-400">Database & Brokerage Sync</p>
              <p className="text-sm font-bold text-slate-100 mt-0.5">Last Sheets Sync: {formatLastSync(lastSync)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsConfirmingClearCache(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-neon-crimson/10 border border-neon-crimson/25 hover:bg-neon-crimson/25 text-neon-crimson rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Clear Sheets Cache</span>
              </button>
              <button
                onClick={() => setIsConfirmingClearSnapTradeCache(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-neon-crimson/10 border border-neon-crimson/25 hover:bg-neon-crimson/25 text-neon-crimson rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Clear Brokerage Cache</span>
              </button>
              <button
                onClick={() => loadData(true)}
                disabled={isSyncing}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-obsidian-800 border border-obsidian-750 hover:border-obsidian-600 text-slate-200 hover:text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw size={14} className={isSyncing ? 'animate-spin' : ''} />
                <span>Force Refetch Sheets</span>
              </button>
            </div>
          </div>

          {/* Forced Sandbox / Mock Mode */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-obsidian-800/40 border border-obsidian-850 rounded-2xl">
            <div>
              <p className="text-xs font-semibold text-slate-400">Sandbox / Mock Mode</p>
              <p className="text-[10px] text-slate-500 mt-1">Bypasses spreadsheet APIs and forces simulated mock data.</p>
            </div>
            <div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceMock}
                  onChange={(e) => setForceMock(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-obsidian-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-neon-indigo"></div>
              </label>
            </div>
          </div>

          {/* Sync Diagnostics Terminal */}
          <div className="space-y-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="text-xs font-bold text-slate-450 uppercase tracking-wider">Sync logs & Diagnostics</span>
                <p className="text-[10px] text-slate-600 mt-0.5">Stores the latest 300 events. Copy this block when sharing sync failures.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyLogs}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-obsidian-850 border border-obsidian-750 text-[10px] font-bold text-slate-300 hover:text-white hover:border-neon-indigo/50 transition-colors"
                >
                  <Copy size={12} />
                  {logsCopied ? 'Copied' : 'Copy logs'}
                </button>
                <button
                  onClick={() => {
                    safeStorage.setItem('finflow_sync_logs', JSON.stringify([]));
                    setSyncLogs([]);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-obsidian-850 border border-obsidian-750 text-[10px] font-bold text-slate-500 hover:text-neon-crimson transition-colors"
                >
                  Clear logs
                </button>
              </div>
            </div>
            <div className="h-96 max-h-[60vh] overflow-y-auto bg-black/80 border border-obsidian-800 rounded-2xl p-4 font-mono text-xs space-y-1.5 text-slate-300 scrollbar-thin scrollbar-thumb-obsidian-750">
              {syncLogs.length === 0 ? (
                <div className="text-slate-600 italic">No diagnostic events logged yet. Trigger a refetch or sync to generate logs.</div>
              ) : (
                syncLogs.map((log, idx) => {
                  const match = log.match(/^\[([^\]]+)\]\s+(.*)$/);
                  if (match) {
                    const timestamp = match[1];
                    const msg = match[2];
                    let msgColorClass = 'text-slate-200';
                    if (msg.startsWith('$') || msg.includes('finflow db') || msg.includes('finflow snaptrade')) {
                      msgColorClass = 'text-cyan-400 font-bold';
                    } else if (msg.includes('[ERROR]')) {
                      msgColorClass = 'text-neon-crimson font-semibold';
                    } else if (msg.includes('[SUCCESS]')) {
                      msgColorClass = 'text-neon-emerald font-semibold';
                    } else if (msg.includes('[INFO]')) {
                      msgColorClass = 'text-slate-300';
                    }
                    return (
                      <div key={idx} className="whitespace-pre-wrap break-all text-[11px] leading-relaxed">
                        <span className="text-slate-500 mr-2">[{timestamp}]</span>
                        <span className={msgColorClass}>{msg}</span>
                      </div>
                    );
                  }

                  let colorClass = 'text-slate-300';
                  if (log.includes('$') || log.includes('finflow db') || log.includes('finflow snaptrade')) {
                    colorClass = 'text-cyan-400 font-bold';
                  } else if (log.includes('[ERROR]')) {
                    colorClass = 'text-neon-crimson font-semibold';
                  } else if (log.includes('[SUCCESS]')) {
                    colorClass = 'text-neon-emerald font-semibold';
                  } else if (log.includes('[INFO]')) {
                    colorClass = 'text-slate-300';
                  }
                  return (
                    <div key={idx} className={`${colorClass} whitespace-pre-wrap break-all text-[11px] leading-relaxed`}>
                      {log}
                    </div>
                  );
                })
              )}
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
                  Clear Sheets Cached Data?
                </h3>
              </div>
              
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                You are about to clear the offline sync spreadsheet database cache. This is a safe action, but please review what will be deleted versus what remains intact.
              </p>

              <div className="space-y-3 mb-6">
                {/* What is cleared */}
                <div className="bg-neon-crimson/5 border border-neon-crimson/15 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neon-crimson block mb-1">
                    Will Be Cleared
                  </span>
                  <ul className="text-slate-300 text-xs list-disc pl-4 space-y-1">
                    <li>Transactions cache ({transactionCount} records)</li>
                    <li>Balances &amp; categories ({balanceCount} historical entries, {categoryCount} items)</li>
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
                    <li>SnapTrade Brokerage Keys &amp; Session Credentials</li>
                    <li>Gemini AI API Key</li>
                    <li>PIN Shield &amp; Biometric settings</li>
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setIsConfirmingClearCache(false)}
                  className="px-4 py-2 bg-obsidian-800 border border-obsidian-750 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearCache();
                    setIsConfirmingClearCache(false);
                  }}
                  className="px-4 py-2 bg-neon-crimson hover:bg-neon-crimson-hover text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Clear Sheets Cache
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {isConfirmingClearSnapTradeCache && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConfirmingClearSnapTradeCache(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />
            
            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="clear-snaptrade-cache-title"
              className="relative bg-obsidian-900 border border-obsidian-750 rounded-3xl p-6 shadow-2xl max-w-md w-full overflow-hidden z-10 text-left"
            >
              <div className="flex items-center space-x-3 mb-4 text-neon-crimson">
                <AlertTriangle size={24} />
                <h3 id="clear-snaptrade-cache-title" className="text-lg font-bold text-white font-display">
                  Clear Brokerage Cache?
                </h3>
              </div>
              
              <p className="text-xs text-slate-400 mb-4 leading-relaxed">
                You are about to clear the offline holdings and balances cache retrieved from SnapTrade. This is a safe action, but please review what will be deleted versus what remains intact.
              </p>

              <div className="space-y-3 mb-6">
                {/* What is cleared */}
                <div className="bg-neon-crimson/5 border border-neon-crimson/15 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neon-crimson block mb-1">
                    Will Be Cleared
                  </span>
                  <ul className="text-slate-300 text-xs list-disc pl-4 space-y-1">
                    <li>Cached brokerage holdings ({snapTradeHoldings?.positions?.filter(p => p.symbol?.symbol !== 'CASH' && p.assetClass !== 'Alternatives (Options)')?.length || 0} positions)</li>
                    <li>Cached option positions ({snapTradeHoldings?.positions?.filter(p => p.assetClass === 'Alternatives (Options)')?.length || 0} contracts)</li>
                    <li>Cached cash holdings and individual balances</li>
                    <li>Offline holdings JSON cache files on the server</li>
                  </ul>
                </div>

                {/* What remains */}
                <div className="bg-neon-indigo/5 border border-neon-indigo/15 p-3 rounded-xl">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-neon-indigo block mb-1">
                    Remains Safe &amp; Intact
                  </span>
                  <ul className="text-slate-300 text-xs list-disc pl-4 space-y-1">
                    <li>SnapTrade Client ID &amp; Consumer Key credentials</li>
                    <li>User ID &amp; User Secret tokens (Brokerage links remain active)</li>
                    <li>Google Sheets synced transactions cache</li>
                  </ul>
                </div>
              </div>

              <div className="flex space-x-3 justify-end">
                <button
                  onClick={() => setIsConfirmingClearSnapTradeCache(false)}
                  className="px-4 py-2 bg-obsidian-800 border border-obsidian-750 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await clearSnapTradeCache();
                    setIsConfirmingClearSnapTradeCache(false);
                  }}
                  className="px-4 py-2 bg-neon-crimson hover:bg-neon-crimson-hover text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
                >
                  Clear Brokerage Cache
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
