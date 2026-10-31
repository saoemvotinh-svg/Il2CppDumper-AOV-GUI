import React from 'react';
import { Cpu, Terminal, Layers, Wrench } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dump' | 'artifacts' | 'fix-metadata';
  setActiveTab: (tab: 'dump' | 'artifacts' | 'fix-metadata') => void;
  isRunning: boolean;
  totalDlls?: number;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  isRunning,
  totalDlls = 89,
}) => {
  return (
    <header className="border-b border-app-border bg-app-panel select-none">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        {/* Workstation Brand & Diagnostic Readout */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-app-elevated border border-app-border flex items-center justify-center text-accent">
            <Cpu className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm tracking-wide text-ink-primary">
                Il2CppDumper
              </span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-app-elevated text-ink-secondary border border-app-border">
                v6.8-release
              </span>
            </div>
            <div className="text-[11px] text-ink-secondary flex items-center gap-2 mt-0.5 font-mono">
              <span>Target: ARM64</span>
              <span className="text-ink-muted">•</span>
              <span>Metadata v29</span>
              <span className="text-ink-muted">•</span>
              <span className="text-ink-secondary">Tencent XOR Active</span>
            </div>
          </div>
        </div>

        {/* Workstation Mode Switcher (Industrial Segmented Control) */}
        <nav className="flex items-center border border-app-border rounded bg-app-workspace p-0.5 text-xs">
          <button
            onClick={() => setActiveTab('dump')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'dump'
                ? 'bg-app-elevated text-ink-primary border-b-2 border-accent shadow-sm'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-app-elevated/50 border-b-2 border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-ink-secondary" />
            <span>Execution Pipeline</span>
            {isRunning && (
              <span className="w-2 h-2 rounded-full bg-status-warning animate-pulse" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('artifacts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'artifacts'
                ? 'bg-app-elevated text-ink-primary border-b-2 border-accent shadow-sm'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-app-elevated/50 border-b-2 border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-ink-secondary" />
            <span>Artifact Explorer</span>
            <span className="px-1.5 py-0.2 rounded bg-app-workspace border border-app-border text-[10px] font-mono text-ink-secondary">
              {totalDlls}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('fix-metadata')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-sm font-medium transition-colors cursor-pointer ${
              activeTab === 'fix-metadata'
                ? 'bg-app-elevated text-ink-primary border-b-2 border-accent shadow-sm'
                : 'text-ink-secondary hover:text-ink-primary hover:bg-app-elevated/50 border-b-2 border-transparent'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-accent" />
            <span>Fix Metadata</span>
            <span className="px-1.5 py-0.2 rounded bg-accent/15 border border-accent/30 text-[10px] font-mono text-accent font-semibold">
              EA→FA v29
            </span>
          </button>
        </nav>
      </div>
    </header>
  );
};
