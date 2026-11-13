import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { X, Shield, AlertTriangle, Database, CheckCircle2, Terminal } from 'lucide-react';

export const AuthModal: React.FC = () => {
  const navigate = useNavigate();
  const {
    isAuthModalOpen,
    closeAuthModal,
    loginWithGoogle,
    devLogin,
    authStatus,
    authError,
    clearAuthError,
    authModalReturnTo,
  } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isAuthModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeAuthModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) return null;

  const handleGoogleClick = () => {
    if (!isGoogleReady) {
      handleDevLogin();
      return;
    }
    setIsSubmitting(true);
    loginWithGoogle(authModalReturnTo);
  };

  const handleDevLogin = async () => {
    setIsSubmitting(true);
    const success = await devLogin('Demo Operator', 'operator@localhost');
    setIsSubmitting(false);
    if (success) {
      closeAuthModal();
      const target = authModalReturnTo || '/overview';
      navigate(target);
    }
  };

  const isGoogleReady = authStatus?.google_configured ?? false;
  const isMongoLive = authStatus?.mongodb?.connected ?? false;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      {/* Backdrop click dismiss */}
      <div className="absolute inset-0" onClick={closeAuthModal} />

      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-md bg-[#0b0f17] border border-[#1f2937] rounded-lg shadow-2xl p-6 overflow-hidden z-10 font-sans">
        {/* Top Header Rail */}
        <div className="flex items-center justify-between pb-4 border-b border-[#1f2937] mb-5">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#ef4444] animate-pulse" />
            <span className="font-mono text-[11px] font-semibold tracking-wider text-zinc-400 uppercase">
              AUTHENTICATION // OPERATOR IDENT
            </span>
          </div>
          <button
            onClick={closeAuthModal}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/[0.05] transition-colors"
            aria-label="Close authentication modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Title & Description */}
        <div className="mb-6">
          <h2 id="auth-modal-title" className="text-xl font-bold text-white tracking-tight">
            Open Flight Recorder
          </h2>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            Access recorded execution traces, causal counterfactuals, and Guardian autopilot controls.
          </p>
        </div>

        {/* Error Alert Banner */}
        {authError && (
          <div className="mb-4 p-3 rounded bg-red-950/50 border border-red-800/80 text-xs text-red-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-red-300">Authentication Error</p>
              <p className="text-[11px] text-red-400 mt-0.5">{authError}</p>
            </div>
            <button
              onClick={clearAuthError}
              className="text-red-400 hover:text-white text-xs font-mono"
            >
              ✕
            </button>
          </div>
        )}

        {/* Actions Container */}
        <div className="space-y-3">
          {/* Primary: Google OAuth Button */}
          <button
            onClick={handleGoogleClick}
            disabled={isSubmitting}
            className={`w-full py-2.5 px-4 rounded border text-xs font-medium flex items-center justify-center gap-3 transition-all ${
              isGoogleReady
                ? 'bg-white hover:bg-zinc-100 text-zinc-900 border-zinc-200 shadow-sm cursor-pointer'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 cursor-pointer'
            }`}
          >
            {/* Google G SVG */}
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Continue with Google</span>
          </button>

          {!isGoogleReady && (
            <div className="p-2.5 rounded bg-zinc-900/80 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <div className="flex items-center gap-1.5 text-zinc-300 font-mono text-[10px]">
                <Shield className="w-3 h-3 text-cyan-400" />
                <span>OAUTH CONFIGURATION NOTE</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Add <code className="text-zinc-200">GOOGLE_CLIENT_ID</code> and{' '}
                <code className="text-zinc-200">GOOGLE_CLIENT_SECRET</code> to{' '}
                <code className="text-zinc-200">.env</code> for production authentication.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#1f2937]" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase font-mono">
              <span className="bg-[#0b0f17] px-2 text-zinc-500">Or Developer Operator</span>
            </div>
          </div>

          {/* Dev / Operator Quick Login Button */}
          <button
            onClick={handleDevLogin}
            disabled={isSubmitting}
            className="w-full py-3 px-4 rounded-lg bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-transparent border border-amber-500/40 hover:border-amber-400 text-amber-300 text-xs font-mono font-medium flex items-center justify-center gap-2.5 transition-all cursor-pointer shadow-lg active:scale-95"
          >
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>Launch Flight Console (Demo Operator)</span>
          </button>
        </div>

        {/* Backend & Persistence Status Footer */}
        <div className="mt-6 pt-4 border-t border-[#1f2937] flex items-center justify-between text-[10px] font-mono text-zinc-500">
          <div className="flex items-center gap-1.5">
            <Database className="w-3 h-3 text-zinc-400" />
            <span>STORAGE:</span>
            {isMongoLive ? (
              <span className="text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 inline" /> MONGODB LIVE
              </span>
            ) : (
              <span className="text-amber-400">
                {authStatus?.mongodb?.configured ? 'CONNECTING...' : 'LOCAL REPO / MEMORY'}
              </span>
            )}
          </div>
          <span className="text-zinc-600">v0.1.0-AUTH</span>
        </div>
      </div>
    </div>
  );
};
