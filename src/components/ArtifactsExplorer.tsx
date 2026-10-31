import React, { useState } from 'react';
import { apiUrl } from '../config';
import {
  FolderOpen,
  FileCode2,
  Search,
  Layers,
  Check,
  Copy,
  Code,
  FileSpreadsheet,
  RotateCw
} from 'lucide-react';
import type { ArtifactData, SearchResult } from '../types';
import { formatBytes } from '../lib/utils';

interface ArtifactsExplorerProps {
  artifacts: ArtifactData | null;
  onRefresh: () => void;
  onOpenFolder: () => void;
}

export const ArtifactsExplorer: React.FC<ArtifactsExplorerProps> = ({
  artifacts,
  onRefresh,
  onOpenFolder,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dllFilter, setDllFilter] = useState('');
  const [copiedDll, setCopiedDll] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    setIsSearching(true);
    try {
      const res = await fetch(
        apiUrl(`/api/search-dump?query=${encodeURIComponent(searchQuery)}&dir=${encodeURIComponent(
          artifacts?.directory || ''
        )}`)
      );
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedDll(text);
    setTimeout(() => setCopiedDll(null), 2000);
  };

  const filteredDlls =
    artifacts?.dummyDlls.filter((dll) =>
      dll.name.toLowerCase().includes(dllFilter.toLowerCase())
    ) || [];

  return (
    <div className="space-y-4">
      {/* Top Workstation Bar */}
      <section className="panel-frame">
        <div className="panel-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              Decompiled Artifacts & Assemblies
            </h2>
            <span className="text-[11px] font-mono text-ink-muted">
              ({artifacts?.directory || 'Default workspace'})
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <RotateCw className="w-3 h-3 text-ink-secondary" />
              <span>Refresh</span>
            </button>
            <button
              onClick={onOpenFolder}
              className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-pointer font-medium"
            >
              <FolderOpen className="w-3.5 h-3.5 text-accent" />
              <span>Open in Explorer</span>
            </button>
          </div>
        </div>

        {/* Primary Artifact Summary Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-app-border border-b border-app-border bg-app-workspace">
          {[
            {
              title: 'dump.cs',
              desc: 'C# Structs & Members',
              icon: FileCode2,
              targetName: 'dump.cs',
            },
            {
              title: 'DummyDll',
              desc: 'Assemblies for dnSpy',
              icon: Layers,
              targetName: 'DummyDll',
              customCount: `${artifacts?.totalDlls || 0} DLLs`,
            },
            {
              title: 'il2cpp.h',
              desc: 'Ghidra / IDA C Headers',
              icon: Code,
              targetName: 'il2cpp.h',
            },
            {
              title: 'script.json',
              desc: 'Symbol Address Mapping',
              icon: FileSpreadsheet,
              targetName: 'script.json',
            },
          ].map((item) => {
            const matched = artifacts?.artifacts.find((a) => a.name === item.targetName);
            return (
              <div key={item.title} className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-ink-secondary">
                    <item.icon className="w-3.5 h-3.5" />
                    <span className="text-xs font-mono font-medium text-ink-primary">
                      {item.title}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-ink-muted">
                    {item.customCount || (matched ? formatBytes(matched.size) : 'Ready')}
                  </span>
                </div>
                <div className="text-[11px] text-ink-secondary">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Symbol Search In dump.cs */}
      <section className="panel-frame">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              Stream Query: dump.cs Symbols
            </h3>
          </div>
          <span className="text-[11px] text-ink-muted font-mono">
            Direct streaming inspection (1.7M lines)
          </span>
        </div>

        <div className="p-3.5 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search class or method symbol (e.g. RotateHero, CUIHttpFileManagerScript, Hero)..."
                className="control-input w-full pl-8 pr-3 py-1.5 text-xs font-mono"
              />
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
            </div>
            <button
              type="submit"
              disabled={isSearching}
              className="btn-secondary-action px-3 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              {isSearching ? 'Querying...' : 'Search'}
            </button>
          </form>

          {/* Results table */}
          {searchResults.length > 0 && (
            <div className="border border-app-border rounded bg-app-bg max-h-56 overflow-y-auto divide-y divide-app-border/40 font-mono text-xs">
              {searchResults.map((res, i) => (
                <div key={i} className="px-3 py-1.5 flex items-start gap-3 hover:bg-app-elevated/40">
                  <span className="text-ink-muted text-[11px] shrink-0 select-none">
                    L{res.line}
                  </span>
                  <span className="text-ink-primary break-all">{res.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Assembly Listing */}
      <section className="panel-frame">
        <div className="panel-header flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              DummyDll Assemblies ({filteredDlls.length} / {artifacts?.totalDlls || 0})
            </h3>
          </div>
          <input
            type="text"
            value={dllFilter}
            onChange={(e) => setDllFilter(e.target.value)}
            placeholder="Filter assembly name..."
            className="control-input px-2.5 py-1 text-xs font-mono w-full sm:w-60"
          />
        </div>

        <div className="p-3.5 max-h-80 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {filteredDlls.map((dll) => (
              <div
                key={dll.name}
                className="p-2 rounded border border-app-border bg-app-elevated/40 hover:bg-app-elevated flex items-center justify-between transition-colors"
              >
                <div className="overflow-hidden mr-2">
                  <div className="text-xs font-mono text-ink-primary truncate">{dll.name}</div>
                  <div className="text-[11px] font-mono text-ink-muted">
                    {formatBytes(dll.size)}
                  </div>
                </div>
                <button
                  onClick={() => copyToClipboard(dll.name)}
                  className="p-1 rounded text-ink-muted hover:text-ink-primary transition-colors cursor-pointer"
                  title="Copy assembly name"
                >
                  {copiedDll === dll.name ? (
                    <Check className="w-3.5 h-3.5 text-status-ready" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
