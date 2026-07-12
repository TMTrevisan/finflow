import React, { useState, useEffect } from 'react';
import { Lock, ShieldCheck, Delete, Fingerprint } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { safeStorage } from '../../utils/storage';

export default function PasscodeLock({ children }) {
  const [passcode, setPasscode] = useState('');
  const [isLocked, setIsLocked] = useState(true);
  const [isError, setIsError] = useState(false);
  const [hasPasscode, setHasPasscode] = useState(false);
  const [lockoutTimeLeft, setLockoutTimeLeft] = useState(0);

  // Check if passcode is configured in safeStorage & Auto-migrate
  useEffect(() => {
    const configuredPIN = safeStorage.getItem('finflow_passcode');
    if (configuredPIN) {
      setHasPasscode(true);
      setIsLocked(true);
      
      // Auto-migrate plaintext 4-digit PINs to SHA-256 hashes
      if (/^\d{4}$/.test(configuredPIN)) {
        const migratePIN = async () => {
          const msgBuffer = new TextEncoder().encode(configuredPIN);
          const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
          const hashArray = Array.from(new Uint8Array(hashBuffer));
          const hashed = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
          safeStorage.setItem('finflow_passcode', hashed);
        };
        migratePIN().catch(console.error);
      }
    } else {
      setHasPasscode(false);
      setIsLocked(false);
    }
  }, []);

  // Lockout backoff check loop
  useEffect(() => {
    const checkLockout = () => {
      const lockoutUntil = parseInt(safeStorage.getItem('finflow_lockout_until') || '0', 10);
      const now = Date.now();
      if (lockoutUntil > now) {
        setLockoutTimeLeft(Math.ceil((lockoutUntil - now) / 1000));
      } else {
        setLockoutTimeLeft(0);
      }
    };
    checkLockout();
    const interval = setInterval(checkLockout, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleBiometricAuth = async () => {
    if (safeStorage.getItem('finflow_biometrics_enabled') !== 'true') return;
    
    // Check if currently locked out
    const lockoutUntil = parseInt(safeStorage.getItem('finflow_lockout_until') || '0', 10);
    if (lockoutUntil > Date.now()) return;

    try {
      const challenge = crypto.getRandomValues(new Uint8Array(32));
      const storedCredId = safeStorage.getItem('finflow_biometric_cred_id');
      
      const allowCredentials = [];
      if (storedCredId) {
        const padded = storedCredId.replace(/-/g, '+').replace(/_/g, '/');
        const bin = window.atob(padded);
        const buf = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) {
          buf[i] = bin.charCodeAt(i);
        }
        allowCredentials.push({
          type: "public-key",
          id: buf.buffer
        });
      }

      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge,
          rpId: window.location.hostname,
          userVerification: "required",
          ...(allowCredentials.length > 0 ? { allowCredentials } : {})
        }
      });
      
      if (assertion) {
        // Reset attempts
        safeStorage.removeItem('finflow_lockout_attempts');
        safeStorage.removeItem('finflow_lockout_until');
        setIsLocked(false);
      }
    } catch (err) {
      console.warn("Biometric verification failed or bypassed:", err);
    }
  };

  // Trigger biometric unlock automatically when PIN screen is displayed
  useEffect(() => {
    if (hasPasscode && isLocked && lockoutTimeLeft === 0) {
      const timer = setTimeout(() => {
        handleBiometricAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [hasPasscode, isLocked, lockoutTimeLeft]);

  const handleKeyPress = (num) => {
    if (passcode.length >= 4 || lockoutTimeLeft > 0) return;
    setIsError(false);
    
    const newPasscode = passcode + num;
    setPasscode(newPasscode);

    if (newPasscode.length === 4) {
      const storedPIN = safeStorage.getItem('finflow_passcode');
      
      const validatePIN = async () => {
        const msgBuffer = new TextEncoder().encode(newPasscode);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const enteredHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        if (enteredHash === storedPIN) {
          safeStorage.removeItem('finflow_lockout_attempts');
          safeStorage.removeItem('finflow_lockout_until');
          setTimeout(() => {
            setIsLocked(false);
          }, 300);
        } else {
          const attempts = parseInt(safeStorage.getItem('finflow_lockout_attempts') || '0', 10) + 1;
          safeStorage.setItem('finflow_lockout_attempts', String(attempts));

          if (attempts >= 5) {
            const backoffSec = Math.min(1800, 30 * Math.pow(2, attempts - 5));
            const lockoutUntil = Date.now() + backoffSec * 1000;
            safeStorage.setItem('finflow_lockout_until', String(lockoutUntil));
            setLockoutTimeLeft(backoffSec);
          }

          setTimeout(() => {
            setIsError(true);
            setPasscode('');
            if (navigator.vibrate) navigator.vibrate(200);
          }, 300);
        }
      };

      validatePIN().catch(console.error);
    }
  };

  const handleDelete = () => {
    if (passcode.length > 0 && lockoutTimeLeft === 0) {
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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-obsidian-955 text-white font-sans select-none">
      {/* Visual Accents */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-72 h-72 bg-neon-indigo/10 rounded-full blur-3xl pointer-events-none"></div>
      
      <div className="relative z-10 flex flex-col items-center max-w-sm w-full px-6">
        {/* Header Section */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="bg-obsidian-800 p-4 rounded-3xl border border-obsidian-700/80 mb-4 shadow-xl">
            <Lock size={32} className="text-neon-indigo animate-pulse" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white mb-2 font-display">FinFlow Guard</h1>
          <p className="text-sm text-slate-400">Enter your PIN or use biometrics to continue</p>
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

        {/* Incorrect warning / Lockout message */}
        <div className="h-6 mb-4 flex justify-center items-center">
          <AnimatePresence>
            {lockoutTimeLeft > 0 ? (
              <motion.span 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs font-bold text-neon-crimson uppercase tracking-wider animate-pulse"
              >
                Too many attempts. Lockout: {lockoutTimeLeft}s
              </motion.span>
            ) : isError ? (
              <motion.span 
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-xs font-semibold text-neon-crimson uppercase tracking-wider animate-bounce"
              >
                Incorrect PIN. Try again.
              </motion.span>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 w-full">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              onClick={() => handleKeyPress(num)}
              disabled={lockoutTimeLeft > 0}
              className={`aspect-square flex items-center justify-center bg-obsidian-850 border border-obsidian-800/80 active:border-neon-indigo/50 text-xl font-bold rounded-2xl transition-all shadow-md text-slate-200 ${
                lockoutTimeLeft > 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-obsidian-800 active:scale-95'
              }`}
            >
              {num}
            </button>
          ))}
          
          {/* Biometric trigger on the bottom-left button */}
          {safeStorage.getItem('finflow_biometrics_enabled') === 'true' ? (
            <button
              onClick={handleBiometricAuth}
              disabled={lockoutTimeLeft > 0}
              className={`aspect-square flex items-center justify-center bg-obsidian-850 border border-obsidian-800/80 active:border-neon-indigo/50 text-neon-indigo rounded-2xl transition-all shadow-md ${
                lockoutTimeLeft > 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-obsidian-800 active:scale-95'
              }`}
            >
              <Fingerprint size={24} />
            </button>
          ) : (
            <div className="aspect-square flex items-center justify-center" />
          )}

          <button
            onClick={() => handleKeyPress(0)}
            disabled={lockoutTimeLeft > 0}
            className={`aspect-square flex items-center justify-center bg-obsidian-850 border border-obsidian-800/80 active:border-neon-indigo/50 text-xl font-bold rounded-2xl transition-all shadow-md text-slate-200 ${
              lockoutTimeLeft > 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-obsidian-800 active:scale-95'
            }`}
          >
            0
          </button>

          <button
            onClick={handleDelete}
            disabled={lockoutTimeLeft > 0}
            className={`aspect-square flex items-center justify-center bg-obsidian-850/50 border border-transparent text-slate-400 rounded-2xl transition-all ${
              lockoutTimeLeft > 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-obsidian-800 hover:text-white active:scale-95'
            }`}
          >
            <Delete size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}
