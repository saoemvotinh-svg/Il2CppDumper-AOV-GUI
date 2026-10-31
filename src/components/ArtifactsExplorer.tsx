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
  RotateCw,
  Box,
  X,
  ArrowUpRight
} from 'lucide-react';
import type { ArtifactData, SymbolItem, ClassDetail, DllClassSummary } from '../types';
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
  // --- Symbol Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [symbolTypeFilter, setSymbolTypeFilter] = useState<'all' | 'method' | 'field' | 'class'>('all');
  const [symbolResults, setSymbolResults] = useState<SymbolItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [tookMs, setTookMs] = useState<number | null>(null);

  // --- DLL Explorer State ---
  const [dllFilter, setDllFilter] = useState('');
  const [selectedDll, setSelectedDll] = useState<string | null>(null);
  const [dllClasses, setDllClasses] = useState<DllClassSummary[]>([]);
  const [isLoadingDllClasses, setIsLoadingDllClasses] = useState(false);
  const [dllClassFilter, setDllClassFilter] = useState('');

  // --- Active Class Details Modal/Drawer State ---
  const [selectedClass, setSelectedClass] = useState<ClassDetail | null>(null);
  const [isLoadingClass, setIsLoadingClass] = useState(false);
  const [activeClassTab, setActiveClassTab] = useState<'methods' | 'fields' | 'code'>('methods');
  const [classMemberFilter, setClassMemberFilter] = useState('');

  // --- Clipboard feedback ---
  const [copiedText, setCopiedText] = useState<string | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(null), 2000);
  };

  // Perform Deep Symbol Search
  const handleSearch = async (e?: React.FormEvent, overrideType?: 'all' | 'method' | 'field' | 'class') => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || searchQuery.length < 2) return;

    const filterType = overrideType || symbolTypeFilter;
    setIsSearching(true);
    try {
      const res = await fetch(
        apiUrl(
          `/api/search-dump?query=${encodeURIComponent(searchQuery)}&type=${filterType}&limit=50&dir=${encodeURIComponent(
            artifacts?.directory || ''
          )}`
        )
      );
      const data = await res.json();
      setSymbolResults(data.results || []);
      setTookMs(data.tookMs || null);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // Open DLL Inspector
  const handleOpenDll = async (dllName: string) => {
    setSelectedDll(dllName);
    setIsLoadingDllClasses(true);
    setDllClassFilter('');
    try {
      const res = await fetch(
        apiUrl(`/api/dll-classes?dll=${encodeURIComponent(dllName)}&dir=${encodeURIComponent(artifacts?.directory || '')}`)
      );
      const data = await res.json();
      setDllClasses(data.classes || []);
      if (data.classes && data.classes.length > 0) {
        // Automatically inspect first class
        handleInspectClass(data.classes[0].typeDefIndex, data.classes[0].name);
      } else {
        setSelectedClass(null);
      }
    } catch (err) {
      console.error('Failed to load DLL classes:', err);
    } finally {
      setIsLoadingDllClasses(false);
    }
  };

  // Inspect Class Details (Fields, Methods, Code)
  const handleInspectClass = async (typeDefIndex?: number, name?: string, tab: 'methods' | 'fields' | 'code' = 'methods') => {
    setIsLoadingClass(true);
    setActiveClassTab(tab);
    setClassMemberFilter('');
    try {
      const queryParam = typeDefIndex !== undefined ? `typeDefIndex=${typeDefIndex}` : `name=${encodeURIComponent(name || '')}`;
      const res = await fetch(
        apiUrl(`/api/class-details?${queryParam}&dir=${encodeURIComponent(artifacts?.directory || '')}`)
      );
      const data = await res.json();
      setSelectedClass(data);
    } catch (err) {
      console.error('Failed to load class details:', err);
    } finally {
      setIsLoadingClass(false);
    }
  };

  const filteredDlls =
    artifacts?.dummyDlls.filter((dll) =>
      dll.name.toLowerCase().includes(dllFilter.toLowerCase())
    ) || [];

  const filteredDllClasses = dllClasses.filter((c) =>
    c.name.toLowerCase().includes(dllClassFilter.toLowerCase()) ||
    c.namespace.toLowerCase().includes(dllClassFilter.toLowerCase())
  );

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

      {/* Deep Symbol Search In dump.cs */}
      <section className="panel-frame">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              Deep Symbol Query (Method / Field / Class / Hierarchy)
            </h3>
          </div>
          <span className="text-[11px] text-ink-muted font-mono">
            {tookMs !== null ? `Query completed in ${tookMs}ms` : 'Searches 1.7M lines with full inheritance'}
          </span>
        </div>

        <div className="p-3.5 space-y-3">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. SetVisible, radius, LobbyExtraCoinUI, HeroAvatarView)..."
                className="control-input w-full pl-8 pr-3 py-1.5 text-xs font-mono"
              />
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
            </div>

            {/* Type Filter Tabs */}
            <div className="flex items-center gap-1 bg-app-elevated p-0.5 rounded border border-app-border">
              {(['all', 'method', 'field', 'class'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSymbolTypeFilter(t);
                    if (searchQuery.length >= 2) handleSearch(undefined, t);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider rounded transition-colors cursor-pointer ${
                    symbolTypeFilter === t
                      ? 'bg-accent text-app-bg font-semibold shadow-sm'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  {t === 'all' ? 'All' : t + 's'}
                </button>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSearching}
              className="btn-secondary-action px-4 py-1.5 text-xs font-medium cursor-pointer disabled:opacity-50"
            >
              {isSearching ? 'Scanning...' : 'Search'}
            </button>
          </form>

          {/* Results Grid / List */}
          {symbolResults.length > 0 && (
            <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
              <div className="text-[11px] font-mono text-ink-muted px-1">
                Found {symbolResults.length} matching symbols:
              </div>

              {symbolResults.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded border border-app-border bg-app-workspace hover:border-app-border/80 transition-all space-y-2"
                >
                  {/* Top Metadata Row */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {/* Symbol Type Badge */}
                      <span
                        className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${
                          item.symbolType === 'method'
                            ? 'bg-accent/20 text-accent border border-accent/40'
                            : item.symbolType === 'field'
                            ? 'bg-status-ready/20 text-status-ready border border-status-ready/40'
                            : 'bg-app-elevated text-ink-primary border border-app-border'
                        }`}
                      >
                        {item.symbolType}
                      </span>

                      {/* Symbol Name */}
                      <span className="text-xs font-mono font-semibold text-ink-primary">
                        {item.name}
                      </span>

                      {/* DLL Badge */}
                      <button
                        onClick={() => handleOpenDll(item.dll)}
                        className="text-[11px] font-mono text-ink-secondary bg-app-elevated px-2 py-0.5 rounded border border-app-border hover:border-accent hover:text-accent flex items-center gap-1 cursor-pointer transition-colors"
                        title="Open this Assembly in Inspector"
                      >
                        <Box className="w-3 h-3 text-accent" />
                        <span>{item.dll}</span>
                      </button>

                      {/* Enclosing Class Badge */}
                      <button
                        onClick={() => handleInspectClass(item.typeDefIndex, item.enclosingClass)}
                        className="text-[11px] font-mono text-ink-secondary bg-app-elevated px-2 py-0.5 rounded border border-app-border hover:border-accent hover:text-accent cursor-pointer transition-colors"
                        title="Inspect enclosing class"
                      >
                        Class: <span className="font-semibold text-ink-primary">{item.enclosingClass}</span>
                      </button>

                      {/* Parent Class (Class cha) */}
                      {item.baseClass && (
                        <button
                          onClick={() => handleInspectClass(undefined, item.baseClass!)}
                          className="text-[11px] font-mono text-ink-muted bg-app-bg px-2 py-0.5 rounded border border-app-border hover:text-ink-primary cursor-pointer transition-colors"
                          title="Jump to Base Class (Class cha)"
                        >
                          Base: <span className="text-ink-secondary">{item.baseClass}</span>
                        </button>
                      )}

                      {/* Derived Classes (Class con) */}
                      {item.childCount > 0 && (
                        <span className="text-[10px] font-mono text-status-ready bg-status-ready/10 px-1.5 py-0.5 rounded border border-status-ready/30">
                          Subclasses: {item.childCount}
                        </span>
                      )}
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5">
                      {item.rva && (
                        <button
                          onClick={() => copyToClipboard(item.rva!)}
                          className="px-2 py-0.5 rounded text-[11px] font-mono bg-app-elevated hover:bg-app-elevatedHover border border-app-border text-ink-secondary hover:text-ink-primary cursor-pointer transition-colors flex items-center gap-1"
                          title="Copy RVA address"
                        >
                          {copiedText === item.rva ? <Check className="w-3 h-3 text-status-ready" /> : <Copy className="w-3 h-3" />}
                          <span>{item.rva}</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleInspectClass(item.typeDefIndex, item.enclosingClass, 'methods')}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-app-elevated hover:bg-app-elevatedHover border border-app-border text-ink-secondary hover:text-accent cursor-pointer transition-colors flex items-center gap-1"
                        title="Inspect full class structure"
                      >
                        <Layers className="w-3 h-3 text-accent" />
                        <span>Inspect Class</span>
                      </button>

                      <button
                        onClick={() => handleInspectClass(item.typeDefIndex, item.enclosingClass, 'code')}
                        className="px-2 py-0.5 rounded text-[11px] font-medium bg-app-elevated hover:bg-app-elevatedHover border border-app-border text-ink-secondary hover:text-accent cursor-pointer transition-colors flex items-center gap-1"
                        title="View decompiled C# source"
                      >
                        <Code className="w-3 h-3 text-accent" />
                        <span>View Code</span>
                      </button>
                    </div>
                  </div>

                  {/* Signature Code Box */}
                  <div className="font-mono text-xs text-ink-primary bg-app-bg px-3 py-1.5 rounded border border-app-border/60 overflow-x-auto whitespace-pre">
                    {item.signature}
                  </div>

                  {/* Detailed Parameters / Offset row */}
                  <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-ink-secondary pt-0.5">
                    {item.symbolType === 'method' ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-ink-muted">Parameters ({item.paramCount}):</span>
                          {item.paramCount === 0 ? (
                            <span className="text-ink-muted">void (none)</span>
                          ) : (
                            <span className="text-ink-primary">
                              {item.parameters.map((p) => `${p.type} ${p.name}`).join(', ')}
                            </span>
                          )}
                        </div>
                        {item.returnType && (
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted">Return:</span>
                            <span className="text-ink-primary">{item.returnType}</span>
                          </div>
                        )}
                        {item.offset && (
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted">File Offset:</span>
                            <span className="text-accent">{item.offset}</span>
                          </div>
                        )}
                      </>
                    ) : item.symbolType === 'field' ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-ink-muted">Field Type:</span>
                          <span className="text-ink-primary">{item.fieldType || item.returnType}</span>
                        </div>
                        {(item.fieldOffset || item.offset) && (
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted">Memory Offset:</span>
                            <span className="text-accent font-semibold">{item.fieldOffset || item.offset}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-ink-muted">Access:</span>
                          <span className="text-ink-primary">{item.access}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-ink-muted">Kind:</span>
                          <span className="text-ink-primary">{item.kind}</span>
                        </div>
                        {item.namespace && (
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted">Namespace:</span>
                            <span className="text-ink-primary">{item.namespace}</span>
                          </div>
                        )}
                      </>
                    )}
                    <span className="text-ink-muted ml-auto">Line: {item.line}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Assembly Listing (Clickable for Deep Inspection) */}
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
                className="p-2 rounded border border-app-border bg-app-elevated/40 hover:bg-app-elevated flex items-center justify-between transition-colors group"
              >
                <div
                  onClick={() => handleOpenDll(dll.name)}
                  className="overflow-hidden mr-2 cursor-pointer flex-1"
                  title="Click to explore all classes and code in this DLL"
                >
                  <div className="text-xs font-mono text-ink-primary group-hover:text-accent truncate transition-colors flex items-center gap-1">
                    <span>{dll.name}</span>
                    <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="text-[11px] font-mono text-ink-muted">
                    {formatBytes(dll.size)}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenDll(dll.name)}
                    className="p-1 rounded text-ink-muted hover:text-accent transition-colors cursor-pointer"
                    title="Inspect classes & symbols in this assembly"
                  >
                    <Layers className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => copyToClipboard(dll.name)}
                    className="p-1 rounded text-ink-muted hover:text-ink-primary transition-colors cursor-pointer"
                    title="Copy assembly name"
                  >
                    {copiedText === dll.name ? (
                      <Check className="w-3.5 h-3.5 text-status-ready" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FULL-SCREEN WORKSTATION MODAL: DLL ASSEMBLY & CLASS INSPECTOR */}
      {(selectedDll || selectedClass) && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-3 sm:p-6 backdrop-blur-sm">
          <div className="w-full max-w-7xl h-[92vh] bg-app-workspace border border-app-border rounded-lg flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Top Bar */}
            <div className="px-4 py-2.5 bg-app-elevated border-b border-app-border flex items-center justify-between">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <Box className="w-4 h-4 text-accent shrink-0" />
                <span className="text-xs font-mono font-semibold uppercase tracking-wider text-ink-primary truncate">
                  Assembly Inspector: {selectedDll || selectedClass?.meta.dll || 'Symbol Explorer'}
                </span>
                {dllClasses.length > 0 && (
                  <span className="text-[11px] font-mono text-ink-muted bg-app-bg px-2 py-0.5 rounded border border-app-border shrink-0">
                    {dllClasses.length} Types
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedDll(null);
                    setSelectedClass(null);
                  }}
                  className="p-1.5 rounded text-ink-muted hover:text-ink-primary hover:bg-app-bg transition-colors cursor-pointer"
                  title="Close Inspector"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Split Workstation Pane */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Pane: Classes in this DLL */}
              <div className="w-72 sm:w-80 border-r border-app-border flex flex-col bg-app-bg shrink-0">
                <div className="p-2.5 border-b border-app-border bg-app-elevated/40">
                  <div className="relative">
                    <input
                      type="text"
                      value={dllClassFilter}
                      onChange={(e) => setDllClassFilter(e.target.value)}
                      placeholder="Filter classes..."
                      className="control-input w-full pl-7 pr-2 py-1 text-xs font-mono"
                    />
                    <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2 top-2" />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-app-border/40">
                  {isLoadingDllClasses ? (
                    <div className="p-4 text-xs font-mono text-ink-muted text-center">
                      Loading assembly classes...
                    </div>
                  ) : filteredDllClasses.length === 0 ? (
                    <div className="p-4 text-xs font-mono text-ink-muted text-center">
                      No classes found in assembly
                    </div>
                  ) : (
                    filteredDllClasses.map((cls) => {
                      const isSelected = selectedClass?.meta.typeDefIndex === cls.typeDefIndex;
                      return (
                        <div
                          key={cls.typeDefIndex}
                          onClick={() => handleInspectClass(cls.typeDefIndex, cls.name)}
                          className={`p-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-accent/15 border-l-2 border-accent text-ink-primary'
                              : 'hover:bg-app-elevated/50 text-ink-secondary'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-mono font-medium truncate text-ink-primary">
                              {cls.name}
                            </span>
                            <span className="text-[10px] font-mono text-ink-muted uppercase ml-1">
                              {cls.kind[0]}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px] font-mono text-ink-muted mt-0.5">
                            <span className="truncate">{cls.namespace || '<global>'}</span>
                            {cls.baseClass && (
                              <span className="truncate max-w-[100px] text-ink-muted">
                                : {cls.baseClass}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Pane: Class Symbol Inspector & Code */}
              <div className="flex-1 flex flex-col overflow-hidden bg-app-workspace">
                {isLoadingClass ? (
                  <div className="flex-1 flex items-center justify-center text-xs font-mono text-ink-muted">
                    Loading decompiled class metadata & AST...
                  </div>
                ) : !selectedClass ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-ink-muted text-xs font-mono space-y-2">
                    <Layers className="w-8 h-8 text-ink-muted/50" />
                    <span>Select a class from the list to inspect methods, fields, and code.</span>
                  </div>
                ) : (
                  <>
                    {/* Class Header Banner */}
                    <div className="p-3.5 bg-app-elevated border-b border-app-border space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono uppercase bg-accent/20 text-accent border border-accent/40 px-1.5 py-0.5 rounded font-bold">
                            {selectedClass.meta.kind}
                          </span>
                          <h3 className="text-sm font-mono font-bold text-ink-primary">
                            {selectedClass.meta.name}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyToClipboard(selectedClass.sourceCode)}
                            className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-pointer font-mono"
                          >
                            {copiedText === selectedClass.sourceCode ? (
                              <Check className="w-3 h-3 text-status-ready" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>Copy Class Code</span>
                          </button>
                        </div>
                      </div>

                      {/* Hierarchy Badges (Class cha & Class con) */}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                        {/* Parent Class (Class cha) */}
                        <div className="flex items-center gap-1 bg-app-bg px-2 py-0.5 rounded border border-app-border">
                          <span className="text-ink-muted">Base (Class cha):</span>
                          {selectedClass.meta.baseClass ? (
                            <button
                              onClick={() => handleInspectClass(undefined, selectedClass.meta.baseClass!)}
                              className="text-accent hover:underline cursor-pointer font-semibold"
                            >
                              {selectedClass.meta.baseClass}
                            </button>
                          ) : (
                            <span className="text-ink-muted">None (Root)</span>
                          )}
                        </div>

                        {/* Child Classes (Class con) */}
                        <div className="flex items-center gap-1 bg-app-bg px-2 py-0.5 rounded border border-app-border">
                          <span className="text-ink-muted">Subclasses (Class con):</span>
                          <span className="text-status-ready font-semibold">
                            {selectedClass.meta.childCount}
                          </span>
                          {selectedClass.meta.childCount > 0 && (
                            <span className="text-[10px] text-ink-muted truncate max-w-[200px]">
                              ({selectedClass.meta.childClasses.slice(0, 3).join(', ')}
                              {selectedClass.meta.childCount > 3 ? '...' : ''})
                            </span>
                          )}
                        </div>

                        {/* Namespace */}
                        <div className="flex items-center gap-1 bg-app-bg px-2 py-0.5 rounded border border-app-border">
                          <span className="text-ink-muted">Namespace:</span>
                          <span className="text-ink-secondary">
                            {selectedClass.meta.namespace || '<global>'}
                          </span>
                        </div>

                        {/* Assembly */}
                        <div className="flex items-center gap-1 bg-app-bg px-2 py-0.5 rounded border border-app-border">
                          <span className="text-ink-muted">Assembly:</span>
                          <span className="text-ink-secondary">{selectedClass.meta.dll}</span>
                        </div>
                      </div>
                    </div>

                    {/* View Switcher Tabs */}
                    <div className="flex items-center justify-between px-3 border-b border-app-border bg-app-workspace">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setActiveClassTab('methods')}
                          className={`px-3 py-2 text-xs font-mono uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                            activeClassTab === 'methods'
                              ? 'border-accent text-accent font-semibold'
                              : 'border-transparent text-ink-secondary hover:text-ink-primary'
                          }`}
                        >
                          Methods ({selectedClass.methods.length})
                        </button>
                        <button
                          onClick={() => setActiveClassTab('fields')}
                          className={`px-3 py-2 text-xs font-mono uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                            activeClassTab === 'fields'
                              ? 'border-accent text-accent font-semibold'
                              : 'border-transparent text-ink-secondary hover:text-ink-primary'
                          }`}
                        >
                          Fields ({selectedClass.fields.length})
                        </button>
                        <button
                          onClick={() => setActiveClassTab('code')}
                          className={`px-3 py-2 text-xs font-mono uppercase tracking-wider border-b-2 cursor-pointer transition-colors ${
                            activeClassTab === 'code'
                              ? 'border-accent text-accent font-semibold'
                              : 'border-transparent text-ink-secondary hover:text-ink-primary'
                          }`}
                        >
                          Decompiled C# Code
                        </button>
                      </div>

                      {activeClassTab !== 'code' && (
                        <input
                          type="text"
                          value={classMemberFilter}
                          onChange={(e) => setClassMemberFilter(e.target.value)}
                          placeholder={`Filter ${activeClassTab}...`}
                          className="control-input px-2 py-0.5 text-xs font-mono w-44"
                        />
                      )}
                    </div>

                    {/* Active Tab View */}
                    <div className="flex-1 overflow-y-auto p-3">
                      {/* METHODS TAB */}
                      {activeClassTab === 'methods' && (
                        <div className="space-y-1.5 font-mono text-xs">
                          {selectedClass.methods
                            .filter((m) =>
                              m.name.toLowerCase().includes(classMemberFilter.toLowerCase()) ||
                              m.returnType.toLowerCase().includes(classMemberFilter.toLowerCase())
                            )
                            .map((method, i) => (
                              <div
                                key={i}
                                className="p-2 rounded border border-app-border bg-app-elevated/40 hover:bg-app-elevated flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"
                              >
                                <div className="space-y-0.5 flex-1 min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-[10px] text-ink-muted uppercase">{method.access}</span>
                                    {method.modifier && (
                                      <span className="text-[10px] text-accent uppercase">{method.modifier}</span>
                                    )}
                                    <span className="text-status-ready font-medium">{method.returnType}</span>
                                    <span className="font-semibold text-ink-primary">{method.name}</span>
                                    <span className="text-ink-secondary">
                                      ({method.parameters.map((p) => `${p.type} ${p.name}`).join(', ')})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-ink-muted flex items-center gap-2">
                                    <span>Total parameters: {method.paramCount}</span>
                                    {method.slot && <span>Slot: {method.slot}</span>}
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {method.rva && (
                                    <button
                                      onClick={() => copyToClipboard(method.rva!)}
                                      className="px-2 py-0.5 rounded text-[11px] bg-app-bg hover:bg-app-elevatedHover border border-app-border text-ink-secondary hover:text-accent cursor-pointer flex items-center gap-1"
                                      title="Copy RVA"
                                    >
                                      {copiedText === method.rva ? (
                                        <Check className="w-3 h-3 text-status-ready" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                      <span>RVA: {method.rva}</span>
                                    </button>
                                  )}
                                  {method.offset && (
                                    <span className="text-[11px] text-ink-muted">
                                      Offset: {method.offset}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* FIELDS TAB */}
                      {activeClassTab === 'fields' && (
                        <div className="space-y-1.5 font-mono text-xs">
                          {selectedClass.fields
                            .filter((f) =>
                              f.name.toLowerCase().includes(classMemberFilter.toLowerCase()) ||
                              f.type.toLowerCase().includes(classMemberFilter.toLowerCase())
                            )
                            .map((field, i) => (
                              <div
                                key={i}
                                className="p-2 rounded border border-app-border bg-app-elevated/40 hover:bg-app-elevated flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-ink-muted uppercase">{field.access}</span>
                                  <span className="text-status-ready font-medium">{field.type}</span>
                                  <span className="font-semibold text-ink-primary">{field.name}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {field.offset && (
                                    <button
                                      onClick={() => copyToClipboard(field.offset!)}
                                      className="px-2 py-0.5 rounded text-[11px] bg-app-bg hover:bg-app-elevatedHover border border-app-border text-accent cursor-pointer font-semibold flex items-center gap-1"
                                      title="Copy memory offset"
                                    >
                                      {copiedText === field.offset ? (
                                        <Check className="w-3 h-3 text-status-ready" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                      <span>{field.offset}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* DECOMPILED CODE TAB */}
                      {activeClassTab === 'code' && (
                        <div className="rounded border border-app-border bg-app-bg p-3 overflow-x-auto font-mono text-xs leading-relaxed text-ink-primary">
                          <pre>{selectedClass.sourceCode}</pre>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};