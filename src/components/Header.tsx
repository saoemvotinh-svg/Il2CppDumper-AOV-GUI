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
  const isElectron = Boolean(window.electronAPI?.isElectron);

  return (
    <header className="border-b border-[#2C3236] bg-[#141618] select-none shrink-0 z-30">
      {/* Unified Single Title Bar with Window Drag & Native Overlay Support */}
      <div className="titlebar-drag flex items-center justify-between h-10 px-3">
        {/* Left: App Identity & Architecture Telemetry */}
        <div className="flex items-center gap-2.5 titlebar-no-drag">
          <div className="w-5 h-5 rounded bg-[#1F2326] border border-[#2C3236] flex items-center justify-center text-accent">
            <Cpu className="w-3 h-3 text-[#C49B66]" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs tracking-wide text-[#E6E8E6]">
              IL2CPPDUMPER WORKSTATION PRO
            </span>
            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1F2326] text-[#9FA6A2] border border-[#2C3236]">
              v6.8
            </span>
            <div className="hidden lg:flex items-center gap-1.5 text-[10px] font-mono text-[#676E6A]">
              <span>[ARM64-v8a</span>
              <span>•</span>
              <span>Meta v29 EA/FA</span>
              <span>•</span>
              <span className="text-[#6E9B7B]">XOR 0x69696969]</span>
            </div>
          </div>
        </div>

        {/* Center: Workstation Tab Strip (Visual Studio / IDA Pro dense dock style) */}
        <nav className="titlebar-no-drag flex items-center border border-[#2C3236] rounded bg-[#17191C] p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('dump')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[2px] font-medium transition-colors cursor-default ${
              activeTab === 'dump'
                ? 'bg-[#1F2326] text-[#E6E8E6] border-b border-[#C49B66] shadow-sm'
                : 'text-[#9FA6A2] hover:text-[#E6E8E6] hover:bg-[#1F2326]/50 border-b border-transparent'
            }`}
          >
            <Terminal className="w-3.5 h-3.5 text-[#9FA6A2]" />
            <span>Execution Pipeline</span>
            {isRunning && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#D9A84E] animate-ping" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('artifacts')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[2px] font-medium transition-colors cursor-default ${
              activeTab === 'artifacts'
                ? 'bg-[#1F2326] text-[#E6E8E6] border-b border-[#C49B66] shadow-sm'
                : 'text-[#9FA6A2] hover:text-[#E6E8E6] hover:bg-[#1F2326]/50 border-b border-transparent'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#9FA6A2]" />
            <span>Artifact Explorer</span>
            <span className="px-1.5 py-0.2 rounded bg-[#121416] border border-[#2C3236] text-[10px] font-mono text-[#9FA6A2]">
              {totalDlls}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('fix-metadata')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-[2px] font-medium transition-colors cursor-default ${
              activeTab === 'fix-metadata'
                ? 'bg-[#1F2326] text-[#E6E8E6] border-b border-[#C49B66] shadow-sm'
                : 'text-[#9FA6A2] hover:text-[#E6E8E6] hover:bg-[#1F2326]/50 border-b border-transparent'
            }`}
          >
            <Wrench className="w-3.5 h-3.5 text-[#C49B66]" />
            <span>Fix Metadata</span>
            <span className="px-1.5 py-0.2 rounded bg-[#C49B66]/15 border border-[#C49B66]/30 text-[10px] font-mono text-[#C49B66] font-semibold">
              EA→FA v29
            </span>
          </button>
        </nav>

        {/* Right: Reserved space for Windows TitleBarOverlay native caption buttons */}
        <div className="titlebar-no-drag shrink-0 flex items-center justify-end">
          {isElectron ? (
            <div className="w-[140px] h-10" />
          ) : (
            <div className="text-[11px] font-mono text-[#676E6A]">
              <span>Desktop Bridge Active</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
