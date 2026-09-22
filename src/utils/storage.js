// Safe localStorage wrapper with in-memory fallback for sandboxed/restricted environments
const memoryStore = {};

export const safeStorage = {
  getItem: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return memoryStore[key] || null;
    }
  },
  setItem: (key, value) => {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      memoryStore[key] = value;
      return false;
    }
  },
  removeItem: (key) => {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (e) {
      delete memoryStore[key];
      return false;
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (e) {
      for (const prop of Object.keys(memoryStore)) {
        delete memoryStore[prop];
      }
    }
  }
};

// Session-only credentials, with an independent fallback when storage is blocked.
const sessionMemory = new Map();
export const sessionStore = {
  getItem(key) {
    if (sessionMemory.has(key)) return sessionMemory.get(key);
    try { return sessionStorage.getItem(key); } catch { return null; }
  },
  setItem(key, value) {
    sessionMemory.set(key, String(value));
    try {
      sessionStorage.setItem(key, String(value));
      sessionMemory.delete(key);
      return true;
    } catch { return false; }
  },
  removeItem(key) {
    sessionMemory.set(key, null);
    try {
      sessionStorage.removeItem(key);
      sessionMemory.delete(key);
      return true;
    } catch { return false; }
  }
};

// Run once at startup before rendering; never migrate secrets into another store.
export function wipeLegacySecrets() {
  for (const key of [
    'finflow_gemini_key', 'finflow_openai_key', 'finflow_claude_key',
    'finflow_deepseek_key', 'finflow_mcp_secret', 'finflow_snaptrade_user_secret',
    'finflow_snaptrade_consumer_key'
  ]) {
    safeStorage.removeItem(key);
  }
}
