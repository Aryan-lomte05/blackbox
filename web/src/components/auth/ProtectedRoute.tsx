import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, ArrowLeft, Terminal } from 'lucide-react';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const { isAuthenticated, isLoading, openAuthModal, devLogin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      // Auto-open modal with target return path
      openAuthModal(location.pathname + location.search);
    }
  }, [isLoading, isAuthenticated, location.pathname, location.search, openAuthModal]);

  if (isLoading) {
    return (
      <div className="flex-1 min-h-[60vh] flex flex-col items-center justify-center font-mono text-xs text-zinc-400 gap-3">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-ping" />
          <span className="tracking-widest uppercase">INITIALIZING TELEMETRY STREAM...</span>
        </div>
        <span className="text-[10px] text-zinc-600">VERIFYING OPERATOR CERTIFICATE</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex-1 min-h-[70vh] flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="max-w-md w-full p-8 rounded-lg bg-[#0b0f17] border border-[#1f2937] shadow-xl space-y-5">
          <div className="w-10 h-10 rounded-full bg-red-950/60 border border-red-800/80 flex items-center justify-center mx-auto text-red-400">
            <ShieldAlert className="w-5 h-5" />
          </div>

          <div className="space-y-1.5">
            <span className="font-mono text-[10px] uppercase tracking-wider text-red-400 font-semibold">
              RESTRICTED FLIGHT RECORDER ACCESS
            </span>
            <h2 className="text-lg font-bold text-white tracking-tight">Operator Authentication Required</h2>
            <p className="text-xs text-zinc-400 leading-relaxed">
              This operational partition contains diagnostic graphs, live execution logs, and replay engines.
              Sign in with your authorized credentials to inspect this run.
            </p>
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              onClick={async () => {
                await devLogin('Advay Chavan', 'advay@halfabyte.ai');
              }}
              className="w-full py-2.5 px-4 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Resume Flight Console (Advay Chavan)</span>
            </button>

            <button
              onClick={() => openAuthModal(location.pathname + location.search)}
              className="w-full py-2 px-4 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer font-mono"
            >
              <span>More Authentication Options</span>
            </button>

            <button
              onClick={() => navigate('/')}
              className="w-full py-2 px-4 rounded border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer font-mono"
            >
              <ArrowLeft className="w-3 h-3" />
              <span>Back to Public Overview</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
