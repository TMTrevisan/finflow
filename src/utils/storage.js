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
