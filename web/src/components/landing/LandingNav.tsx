import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { scrollTo } from '../../lib/smooth';
import { Terminal, LogOut, ArrowRight, ShieldCheck, Menu, X } from 'lucide-react';

interface LandingNavProps {
  onOpenAuth: () => void;
}

export const LandingNav: React.FC<LandingNavProps> = ({ onOpenAuth }) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('hero');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);

      const sections = ['faq', 'capabilities', 'lab', 'guardian', 'atlas', 'replay', 'diagnosis', 'forensics', 'process', 'story', 'hero'];
      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 250) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    scrollTo(id);
  };

  const navLinks = [
    { id: 'story', label: 'Story' },
    { id: 'process', label: 'Process' },
    { id: 'forensics', label: 'Forensic Graph' },
    { id: 'replay', label: 'Replay & Fork' },
    { id: 'atlas', label: 'Atlas' },
    { id: 'guardian', label: 'Guardian' },
    { id: 'lab', label: 'Live Lab' },
    { id: 'faq', label: 'FAQ' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-200 select-none ${
        scrolled || mobileMenuOpen
          ? 'bg-[#05070b]/95 backdrop-blur-md border-b border-[#1f2937] py-2.5 shadow-lg'
          : 'bg-transparent border-b border-white/[0.04] py-3.5'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 flex items-center justify-between font-sans">
        {/* Brand Left */}
        <div className="flex items-center gap-3">
          <div
            onClick={() => scrollToSection('hero')}
            className="flex items-center gap-2.5 cursor-pointer group"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-[#ef4444] animate-pulse shadow-xs shadow-[#ef4444]" />
            <span className="font-mono font-bold text-sm tracking-wider text-white group-hover:text-cyan-400 transition-colors">
              BLACK BOX
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-zinc-800 text-[10px] font-mono text-zinc-500">
            <span>FLIGHT RECORDER</span>
            <span className="text-zinc-600">//</span>
            <span className="text-emerald-400/90 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> SYSTEM ACTIVE
            </span>
          </div>
        </div>

        {/* Desktop Minimal Editorial Links */}
        <nav className="hidden md:flex items-center gap-6 text-xs text-zinc-400">
          {navLinks.map((link) => (
            <button
              key={link.id}
              onClick={() => scrollToSection(link.id)}
              className={`transition-colors hover:text-white cursor-pointer ${
                activeSection === link.id ? 'text-cyan-400 font-medium' : ''
              }`}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* Right CTA Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 pr-2.5 sm:pr-3 py-1 rounded bg-zinc-900 border border-zinc-800 text-xs">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name}
                    className="w-5 h-5 rounded-full border border-zinc-700"
                  />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-zinc-800 text-[10px] font-mono flex items-center justify-center text-zinc-300">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-zinc-300 font-medium text-xs hidden md:inline">{user.name}</span>
                <button
                  onClick={() => logout()}
                  title="Sign out"
                  className="ml-1 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={() => navigate('/overview')}
                className="px-2.5 sm:px-3.5 py-1.5 rounded bg-cyan-500 hover:bg-cyan-400 text-black font-semibold text-xs transition-colors flex items-center gap-1 sm:gap-1.5 cursor-pointer shadow-sm shadow-cyan-500/20"
              >
                <span>OPEN</span>
                <span className="hidden sm:inline">BLACK BOX</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={onOpenAuth}
                className="px-2.5 sm:px-3 py-1.5 rounded text-xs text-zinc-300 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer font-medium"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate('/overview')}
                className="px-2.5 sm:px-3.5 py-1.5 rounded border border-zinc-700 hover:border-zinc-500 bg-zinc-900/80 hover:bg-zinc-800 text-white text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Terminal className="w-3 h-3 text-cyan-400" />
                <span className="hidden sm:inline">OPEN RECORDER</span>
                <span className="sm:hidden">RECORDER</span>
              </button>
            </div>
          )}

          {/* Mobile Menu Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-800/80 transition-colors cursor-pointer ml-1"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-zinc-200" /> : <Menu className="w-5 h-5 text-zinc-200" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown Tray */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-[#070a10] border-b border-[#1f2937] px-6 py-4 animate-in slide-in-from-top duration-200">
          <div className="flex flex-col space-y-3 font-mono text-xs">
            {navLinks.map((link) => (
              <button
                key={link.id}
                onClick={() => scrollToSection(link.id)}
                className={`text-left py-1.5 transition-colors cursor-pointer ${
                  activeSection === link.id ? 'text-cyan-400 font-bold' : 'text-zinc-400 hover:text-white'
                }`}
              >
                // {link.label.toUpperCase()}
              </button>
            ))}
            <div className="pt-3 border-t border-zinc-800/80 flex items-center justify-between">
              <span className="text-[10px] text-zinc-500">FLIGHT RECORDER ACTIVE</span>
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  navigate('/overview');
                }}
                className="text-xs text-cyan-400 font-bold flex items-center gap-1"
              >
                <span>LAUNCH CONSOLE</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
