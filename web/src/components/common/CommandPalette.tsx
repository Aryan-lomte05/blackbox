import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Compass, ListFilter, FlaskConical, Sliders, Network, ShieldAlert, Database, Cpu, Server, CheckCircle2, Boxes, ArrowRight, X } from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const screens = [
    { name: 'Overview', path: '/', category: 'Investigate', icon: Compass },
    { name: 'Runs List', path: '/runs', category: 'Investigate', icon: ListFilter },
    { name: 'Investigate (Showcase)', path: '/investigate', category: 'Investigate', icon: Compass },
    { name: 'Live Lab (14 Stages)', path: '/lab', category: 'Investigate', icon: FlaskConical },
    { name: 'Causal Report', path: '/causal', category: 'Prove', icon: Sliders },
    { name: 'Fleet Fix / Firewall', path: '/fleet', category: 'Prove', icon: Sliders },
    { name: 'Crash Test', path: '/crash-test', category: 'Prove', icon: Sliders },
    { name: 'Seen Before? (Fingerprints)', path: '/similar', category: 'Prove', icon: Network },
    { name: 'Incidents (Guardian)', path: '/incidents', category: 'Operate', icon: ShieldAlert },
    { name: 'Failure Atlas', path: '/atlas', category: 'Operate', icon: Network },
    { name: 'Dataset Provenance', path: '/dataset', category: 'Operate', icon: Database },
    { name: 'Machine Telemetry', path: '/machine', category: 'System', icon: Cpu },
    { name: 'API Status & Endpoints', path: '/api-status', category: 'System', icon: Server },
    { name: 'Step Checker Invariants', path: '/checker', category: 'System', icon: CheckCircle2 },
    { name: 'Active Models', path: '/models', category: 'System', icon: Boxes },
    { name: 'Signature Components (Catalog)', path: '/dev/components', category: 'System', icon: Boxes },
  ];

  const filteredScreens = screens.filter((s) =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.category.toLowerCase().includes(query.toLowerCase()) ||
    s.path.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = (path: string) => {
    navigate(path);
    onClose();
  };

  const handleRunSearch = () => {
    if (query.trim()) {
      navigate(`/runs?search=${encodeURIComponent(query.trim())}`);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-start justify-center pt-20 p-4" onClick={onClose}>
      <div
        className="w-full max-w-xl bg-[#0b0f17] border border-[#1f2937] rounded-xl shadow-2xl overflow-hidden font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center px-4 border-b border-[#1f2937]">
          <Search className="w-4 h-4 text-[#9ca3af]" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRunSearch();
            }}
            placeholder="Type a screen, run ID, or task..."
            className="w-full bg-transparent px-3 py-3 text-xs text-[#e5e7eb] placeholder:text-[#6b7280] focus:outline-none font-mono"
          />
          <kbd className="text-[10px] font-mono text-[#6b7280] bg-[#111827] px-1.5 py-0.5 rounded border border-[#1f2937]">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {query.trim().length > 0 && (
            <div
              onClick={handleRunSearch}
              className="p-2.5 rounded-lg hover:bg-[#111827] text-xs font-mono text-[#38bdf8] flex items-center justify-between cursor-pointer"
            >
              <span>Search runs matching &quot;{query}&quot;</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          )}

          {filteredScreens.map((s) => {
            const Icon = s.icon;
            return (
              <div
                key={s.path}
                onClick={() => handleSelect(s.path)}
                className="p-2.5 rounded-lg hover:bg-[#111827] text-xs flex items-center justify-between cursor-pointer transition-colors group"
              >
                <div className="flex items-center gap-2.5 text-[#e5e7eb]">
                  <Icon className="w-3.5 h-3.5 text-[#9ca3af] group-hover:text-white" />
                  <span>{s.name}</span>
                </div>
                <span className="text-[10px] font-mono text-[#6b7280] uppercase">
                  {s.category}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
