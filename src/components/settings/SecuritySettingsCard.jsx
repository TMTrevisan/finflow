import React, { useState, useEffect } from 'react';
import { Card } from '../ui/Card';
import { Lock, Unlock, KeyRound, Fingerprint, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { safeStorage } from '../../utils/storage';

export default function SecuritySettingsCard() {
  // Passcode PIN states
  const [passcodeEnabled, setPasscodeEnabled] = useState(() => {
    return !!safeStorage.getItem('finflow_passcode');
  });
  const [pinInput, setPinInput] = useState('');
  const [passcodeMessage, setPasscodeMessage] = useState(null);

  // Biometrics states
  const [biometricsEnabled, setBiometricsEnabled] = useState(() => {
    return safeStorage.getItem('finflow_biometrics_enabled') === 'true';
  });
  const [biometricsSupported, setBiometricsSupported] = useState(false);
  const [biometricsMessage, setBiometricsMessage] = useState(null);

  useEffect(() => {
    if (window.PublicKeyCredential) {
      window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
        .then(available => setBiometricsSupported(available))
        .catch(() => setBiometricsSupported(false));
    }
  }, []);

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
        setPasscodeMessage({ type: 'success', text: 'PIN Passcode configured securely! Next time you open the app, you will need this PIN.' });
      } catch (err) {
        setPasscodeMessage({ type: 'error', text: `Passcode configuration failed: ${err.message}` });
      }
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

  return (
    <div className="space-y-6">
      {/* Passcode Protection Card */}
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
                <label htmlFor="settings-security-pin" className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Set 4-Digit Passcode PIN</label>
                <input 
                  type="password" 
                  id="settings-security-pin"
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
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer ${
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

      {/* Biometric Unlock Card */}
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
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer ${
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
    </div>
  );
}
