import React, { Component } from 'react';
import { AlertOctagon, RotateCcw, Trash2 } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error("ErrorBoundary caught an exception:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleClearCache = () => {
    try {
      safeStorage.clear();
      // Specifically trigger context clear cache keywords
      safeStorage.removeItem('finflow_cache_transactions');
      safeStorage.removeItem('finflow_cache_categories');
      safeStorage.removeItem('finflow_cache_balances');
      safeStorage.removeItem('finflow_cache_life_opt');
      safeStorage.removeItem('finflow_last_sync');
      window.location.reload();
    } catch (err) {
      alert("Failed to clear browser cache automatically. Please clear site data manually.");
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-full bg-obsidian-950 flex flex-col items-center justify-center p-6 text-slate-200 selection:bg-neon-crimson/30">
          {/* Glowing backdrop */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-neon-crimson/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative w-full max-w-lg bg-obsidian-900/60 border border-neon-crimson/25 backdrop-blur-xl p-6 sm:p-8 rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.08)] space-y-6 text-center">
            {/* Warning Icon */}
            <div className="w-16 h-16 mx-auto rounded-2xl bg-neon-crimson/10 border border-neon-crimson/20 flex items-center justify-center text-neon-crimson shadow-[0_0_15px_rgba(239,68,68,0.15)] animate-pulse">
              <AlertOctagon size={32} />
            </div>

            {/* Headers */}
            <div className="space-y-2">
              <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">Something Went Wrong</h1>
              <p className="text-sm text-slate-400">
                FinFlow encountered a runtime exception. This is often caused by stale browser storage caches.
              </p>
            </div>

            {/* Error detail box */}
            {this.state.error && (
              <div className="p-4 bg-black/40 border border-obsidian-800 rounded-2xl text-left max-h-36 overflow-y-auto custom-scrollbar font-mono text-[10px] sm:text-xs text-neon-crimson/90 space-y-1">
                <p className="font-bold">Error: {this.state.error.toString()}</p>
                {this.state.error.stack && (
                  <pre className="whitespace-pre-wrap leading-relaxed opacity-60">
                    {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                  </pre>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="flex items-center justify-center space-x-2 py-3 bg-neon-indigo hover:bg-neon-indigo/90 text-white font-bold text-sm rounded-xl transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)] active:scale-[0.98]"
              >
                <RotateCcw size={16} />
                <span>Reload App</span>
              </button>

              <button
                onClick={this.handleClearCache}
                className="flex items-center justify-center space-x-2 py-3 bg-obsidian-800 hover:bg-neon-crimson/15 border border-obsidian-700 hover:border-neon-crimson/30 text-slate-300 hover:text-neon-crimson font-bold text-sm rounded-xl transition-all active:scale-[0.98]"
              >
                <Trash2 size={16} />
                <span>Reset App Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
