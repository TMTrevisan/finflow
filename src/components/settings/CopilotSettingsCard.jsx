import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Brain, Link, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export default function CopilotSettingsCard() {
  // Provider and Keys state
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

  // MCP settings state
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
      setMcpMessage({ type: 'info', text: 'MCP Server is cold-starting ( Render server wake up ). This can take up to 50 seconds...' });
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

  return (
    <div className="space-y-6">
      {/* Copilot Core LLM Card */}
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

          <div className="space-y-2">
            <label htmlFor="settings-ai-provider" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">AI Provider</label>
            <select
              id="settings-ai-provider"
              value={aiProvider}
              onChange={(e) => {
                const prov = e.target.value;
                setAiProvider(prov);
                safeStorage.setItem('finflow_ai_provider', prov);
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

          <div className="space-y-2">
            <label htmlFor="settings-ai-model" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Model</label>
            <select
              id="settings-ai-model"
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

          {aiProvider === 'gemini' && (
            <div className="space-y-2">
              <label htmlFor="settings-gemini-key" className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Gemini API Key</span>
                <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Get Free Key</a>
              </label>
              <input 
                type="password" 
                id="settings-gemini-key"
                value={geminiKeyInput}
                onChange={(e) => setGeminiKeyInput(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
              />
            </div>
          )}

          {aiProvider === 'openai' && (
            <div className="space-y-2">
              <label htmlFor="settings-openai-key" className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>OpenAI API Key</span>
                <a href="https://platform.openai.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Platform Dashboard</a>
              </label>
              <input 
                type="password" 
                id="settings-openai-key"
                value={openaiKeyInput}
                onChange={(e) => setOpenaiKeyInput(e.target.value)}
                placeholder="sk-proj-..."
                className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
              />
            </div>
          )}

          {aiProvider === 'claude' && (
            <div className="space-y-2">
              <label htmlFor="settings-claude-key" className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>Anthropic API Key</span>
                <a href="https://console.anthropic.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Console Dashboard</a>
              </label>
              <input 
                type="password" 
                id="settings-claude-key"
                value={claudeKeyInput}
                onChange={(e) => setClaudeKeyInput(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full bg-obsidian-800 border border-obsidian-700 text-white rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-neon-indigo/50 transition-shadow"
              />
            </div>
          )}

          {aiProvider === 'deepseek' && (
            <div className="space-y-2">
              <label htmlFor="settings-deepseek-key" className="block text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
                <span>DeepSeek API Key</span>
                <a href="https://platform.deepseek.com/" target="_blank" rel="noreferrer" className="text-neon-indigo hover:underline normal-case font-medium">Developer Platform</a>
              </label>
              <input 
                type="password" 
                id="settings-deepseek-key"
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
            className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors shadow-md cursor-pointer"
          >
            Save AI Settings
          </button>
        </div>
      </Card>

      {/* Model Context Protocol (MCP) Card */}
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
            className="px-4 py-2 bg-neon-indigo hover:bg-neon-indigo-hover text-white text-xs font-bold rounded-xl transition-colors shadow-md cursor-pointer"
          >
            Save MCP Settings
          </button>
        </div>
      </Card>
    </div>
  );
}
