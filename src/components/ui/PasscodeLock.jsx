import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Delete } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function PasscodeLock({ children }) {
  const [passcode, setPasscode] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [isError, setIsError] = useState(false);
  const [hasPasscode, setHasPasscode] = useState(false);

  // Check if passcode is configured in localStorage
  useEffect(() => {
    const configuredPIN = localStorage.getItem('finflow_passcode');
    if (configuredPIN) {
      setHasPasscode(true);
      setIsLocked(true);
    } else {
      setHasPasscode(false);
      setIsLocked(false);
    }
  }, []);

  const handleKeyPress = (num) => {
    if (passcode.length >= 4) return;
    setIsError(false);
    
    const newPasscode = passcode + num;
    setPasscode(newPasscode);

    if (newPasscode.length === 4) {
      // Validate
      const storedPIN = localStorage.getItem('finflow_passcode');
      if (newPasscode === storedPIN) {
        // Correct PIN
        setTimeout(() => {
          setIsLocked(false);
        }, 300);
      } else {
        // Incorrect PIN
        setTimeout(() => {
          setIsError(true);
          setPasscode('');
          // Vibrate if supported
          if (navigator.vibrate) navigator.vibrate(200);
        }, 300);
      }
    }
  };

  const handleDelete = () => {
    if (passcode.length > 0) {
      setPasscode(passcode.slice(0, -1));
    }
  };

  // If no passcode is configured, just render children directly
  if (!hasPasscode || !isLocked) {
    return <>{children}</>;
  }

  const dotContainerVariants = {
    shake: {
      x: [0, -10, 10, -10, 10, -5, 5, 0],
      transition: { duration: 0.4 }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-obsidian-950 text-white font-sans">
      {/* Visual Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-neon-indigo/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="bg-obsidian-800 p-4 rounded-3xl border border-obsidian-700/80 mb-4 shadow-xl">
            <Lock size={32} className="text-neon-indigo animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2">FinFlow Guard</h1>
          <p className="text-sm text-slate-400">Enter your 4-digit PIN to access your vault</p>
        </div>

        {/* 4 dots entry visualization */}
        <motion.div 
          variants={dotContainerVariants}
          animate={isError ? "shake" : "default"}
          className="flex space-x-6 mb-12 justify-center"
        >
          {[0, 1, 2, 3].map((index) => (
            <div 
              key={index}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                isError 
                  ? 'border-neon-crimson bg-neon-crimson/30 scale-110' 
                  : index < passcode.length
                    ? 'border-neon-indigo bg-neon-indigo scale-110 shadow-glow'
                    : 'border-slate-700 bg-transparent'
              }`}
            />
          ))}
        </motion.div>

        {/* Incorrect warning message */}
        <div className="h-6 mb-4 flex justify-center items-center">
          <AnimatePresence>
            {isError && (
              <motion.span 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-neon-crimson uppercase tracking-wider"
              >
                Incorrect Passcode. Try again.
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              className="aspect-square flex items-center justify-center bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-800/80 active:border-neon-indigo/50 text-xl font-bold rounded-2xl transition-all active:scale-95 shadow-md text-slate-200"
            >
              {num}
            </button>
          ))}
          
          {/* Spacer / Unused key */}
          <div className="aspect-square flex items-center justify-center" />

          <button
            onClick={() => handleKeyPress(0)}
            className="aspect-square flex items-center justify-center bg-obsidian-850 hover:bg-obsidian-800 border border-obsidian-800/80 active:border-neon-indigo/50 text-xl font-bold rounded-2xl transition-all active:scale-95 shadow-md text-slate-200"
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="aspect-square flex items-center justify-center bg-obsidian-850/50 hover:bg-obsidian-800 border border-transparent text-slate-400 hover:text-white rounded-2xl transition-all active:scale-95"
          >
            <Delete size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
