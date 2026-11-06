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
  ArrowLeft,
  ArrowUpRight,
  Terminal,
  Cpu,
  Sparkles
} from 'lucide-react';
import type { ArtifactData, SymbolItem, ClassDetail, DllClassSummary, IndexingStatus } from '../types';
import { CodeViewer } from './CodeViewer';
import { MethodAccordion } from './MethodAccordion';
import { Download } from 'lucide-react';
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
  // --- Source Selection (dumpv2.cs vs dump.cs) ---
  const [activeSource, setActiveSource] = useState<'dumpv2.cs' | 'dump.cs'>('dump.cs');

  // Sync default source when artifacts data arrives
  React.useEffect(() => {
    if (artifacts?.hasDumpV2) {
      setActiveSource('dumpv2.cs');
    } else {
      setActiveSource('dump.cs');
    }
  }, [artifacts?.hasDumpV2]);

  // --- In-Memory Indexing Status ---
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);

  // Poll indexing status periodically
  React.useEffect(() => {
    let interval: any = null;
    const fetchStatus = async () => {
      try {
        const res = await fetch(apiUrl('/api/indexing-status'));
        if (res.ok) {
          const data: IndexingStatus = await res.json();
          setIndexingStatus(data);
        }
      } catch (err) {
        // ignore
      }
    };

    fetchStatus();
    interval = setInterval(fetchStatus, 1000);
    return () => {
      if (interval) clearInterval(interval);
    };
  }, []);

  // --- Symbol Search State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [symbolTypeFilter, setSymbolTypeFilter] = useState<'all' | 'method' | 'field' | 'class' | 'body'>('all');
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

  // --- On-Demand In-Memory Index Activation ---
  const [isActivatingIndex, setIsActivatingIndex] = useState(false);

  const handleActivateIndex = async (force = false) => {
    setIsActivatingIndex(true);
    try {
      await fetch(apiUrl('/api/activate-indexing'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source: activeSource,
          dir: artifacts?.directory || '',
          force
        })
      });
    } catch (err) {
      console.error('Failed to activate indexing:', err);
    } finally {
      setIsActivatingIndex(false);
    }
  };

  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Perform Deep Symbol Search
  const handleSearch = async (
    e?: React.FormEvent,
    overrideType?: 'all' | 'method' | 'field' | 'class' | 'body',
    overrideQuery?: string
  ) => {
    if (e) e.preventDefault();
    const q = (overrideQuery !== undefined ? overrideQuery : searchQuery).trim();
    if (!q || q.length < 2) {
      setSymbolResults([]);
      return;
    }

    const filterType = overrideType || symbolTypeFilter;
    if (indexingStatus?.phase === 'idle' && !indexingStatus?.isIndexing) {
      handleActivateIndex(false);
    }
    setIsSearching(true);
    try {
      const res = await fetch(
        apiUrl(
          `/api/search-dump?query=${encodeURIComponent(q)}&type=${filterType}&limit=100&source=${activeSource}${filterType === 'body' ? '&searchBody=true' : ''}&dir=${encodeURIComponent(
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

  // Debounced search to ensure 60fps ultra-smooth typing without lag
  React.useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        handleSearch(undefined, symbolTypeFilter, searchQuery);
      } else if (searchQuery.trim().length === 0) {
        setSymbolResults([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery, symbolTypeFilter, activeSource]);

  // Desktop keyboard shortcuts: Ctrl+F to focus search, Esc to close inspector
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (e.key === 'Escape' && (selectedDll || selectedClass)) {
        e.preventDefault();
        setSelectedDll(null);
        setSelectedClass(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedDll, selectedClass]);

  // Open DLL Inspector
  const handleOpenDll = async (dllName: string) => {
    setSelectedDll(dllName);
    setIsLoadingDllClasses(true);
    setDllClassFilter('');
    try {
      const res = await fetch(
        apiUrl(`/api/dll-classes?dll=${encodeURIComponent(dllName)}&source=${activeSource}&dir=${encodeURIComponent(artifacts?.directory || '')}`)
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
        apiUrl(`/api/class-details?${queryParam}&source=${activeSource}&dir=${encodeURIComponent(artifacts?.directory || '')}`)
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

  if (selectedDll || selectedClass) {
    return (
      <div className="flex-1 flex flex-col h-full bg-[#17191C] overflow-hidden select-none">
            {/* Desktop Command Bar */}
            <div className="h-10 px-3 bg-[#151719] border-b border-[#2C3236] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                setSelectedDll(null);
                setSelectedClass(null);
              }}
              className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-default font-mono hover:text-[#E6E8E6]"
              title="Back to Artifacts Overview (Esc)"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-[#C49B66]" />
              <span>Back</span>
            </button>
            <span className="text-[#2C3236]">|</span>
            <Box className="w-4 h-4 text-[#C49B66] shrink-0" />
                <div className="flex items-center gap-1.5 text-xs font-mono text-[#E6E8E6] truncate">
                  <span className="text-[#9FA6A2]">Assembly:</span>
                  <span className="font-semibold text-[#C49B66]">{selectedDll || selectedClass?.meta.dll || 'Symbol Explorer'}</span>
                  {selectedClass && (
                    <>
                      <span className="text-[#676E6A]">›</span>
                      <span className="text-[#9FA6A2]">Class:</span>
                      <span className="font-semibold text-[#E6E8E6]">{selectedClass.meta.name}</span>
                      <span className="text-[10px] text-[#676E6A] bg-[#121416] px-1.5 py-0.2 rounded border border-[#2C3236]">
                        TypeDef: {selectedClass.meta.typeDefIndex}
                      </span>
                    </>
                  )}
                  {dllClasses.length > 0 && (
                    <span className="text-[11px] font-mono text-[#9FA6A2] bg-[#121416] px-2 py-0.5 rounded border border-[#2C3236] shrink-0 ml-1">
                      {dllClasses.length} Types
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDll(null);
                    setSelectedClass(null);
                  }}
                  className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-default font-mono"
                  title="Close Inspector (Esc)"
                >
                  <span>Close</span>
                  <kbd className="text-[10px] bg-[#121416] px-1 py-0.2 rounded border border-[#2C3236] text-[#676E6A]">Esc</kbd>
                  <X className="w-3.5 h-3.5 text-[#9FA6A2]" />
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
                          {selectedClass.isDecompiledClass && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                              <Sparkles className="w-3 h-3" />
                              <span>Hex-Rays: {selectedClass.decompiledMethodCount} / {selectedClass.totalMethods} methods</span>
                            </span>
                          )}
                          <a
                            href={apiUrl(`/api/export-class-cs?typeDefIndex=${selectedClass.meta.typeDefIndex}&source=${activeSource}&beautify=true&dir=${encodeURIComponent(artifacts?.directory || '')}`)}
                            download={`${selectedClass.meta.name}.cs`}
                            className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-pointer font-mono text-accent hover:border-accent"
                            title="Download this class as standalone .cs file"
                          >
                            <Download className="w-3 h-3" />
                            <span>Export .cs</span>
                          </a>
                          <button
                            onClick={() => copyToClipboard(selectedClass.sourceCode)}
                            className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-pointer font-mono"
                          >
                            {copiedText === selectedClass.sourceCode ? (
                              <Check className="w-3 h-3 text-status-ready" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            <span>Copy Code</span>
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
                              m.returnType.toLowerCase().includes(classMemberFilter.toLowerCase()) ||
                              (m.body && m.body.toLowerCase().includes(classMemberFilter.toLowerCase()))
                            )
                            .map((method, i) => (
                              <MethodAccordion
                                key={i}
                                method={method}
                                copiedText={copiedText}
                                onCopy={copyToClipboard}
                                onSymbolClick={(sym) => handleInspectClass(undefined, sym)}
                              />
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
                                className="p-2.5 rounded border border-app-border bg-app-elevated/40 hover:bg-app-elevated flex items-center justify-between gap-2"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] text-ink-muted uppercase">{field.access}</span>
                                  <span className="text-status-ready font-medium select-text">{field.type}</span>
                                  <span className="font-semibold text-ink-primary select-text">{field.name}</span>
                                  <button
                                    onClick={() => copyToClipboard(field.name)}
                                    className="p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
                                    title="Copy field name"
                                  >
                                    <Copy className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    onClick={() => copyToClipboard(field.raw)}
                                    className="p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer text-[10px]"
                                    title="Copy full field definition"
                                  >
                                    [Copy Line]
                                  </button>
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
                                      <span className="select-text">{field.offset}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                        </div>
                      )}

                      {/* DECOMPILED CODE TAB */}
                      {activeClassTab === 'code' && (
                        <div className="h-full min-h-[450px]">
                          <CodeViewer
                            code={selectedClass.sourceCode}
                            cleanCode={selectedClass.cleanSourceCode}
                            fileName={`${selectedClass.meta.name}.cs`}
                            isDecompiled={selectedClass.isDecompiledClass}
                            onSymbolClick={(sym) => handleInspectClass(undefined, sym)}
                            onDownloadCs={() => {
                              window.open(apiUrl(`/api/export-class-cs?typeDefIndex=${selectedClass.meta.typeDefIndex}&source=${activeSource}&beautify=true&dir=${encodeURIComponent(artifacts?.directory || '')}`));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-3 py-2.5 space-y-4">
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
            const targetPath = matched ? matched.path : (artifacts?.directory ? `${artifacts.directory}\\${item.targetName}` : item.targetName);
            return (
              <div key={item.title} className="p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-ink-secondary">
                    <item.icon className="w-3.5 h-3.5 text-accent" />
                    <span className="text-xs font-mono font-medium text-ink-primary">
                      {item.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-mono text-ink-muted">
                      {item.customCount || (matched ? formatBytes(matched.size) : 'Ready')}
                    </span>
                    <button
                      onClick={() => copyToClipboard(targetPath)}
                      className="text-ink-muted hover:text-accent p-0.5 cursor-pointer transition-colors"
                      title={`Copy ${item.title} path`}
                    >
                      {copiedText === targetPath ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-ink-secondary">{item.desc}</div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Dual Source Switcher & Decompiled Engine Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border border-app-border bg-app-elevated/40">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Active Engine:</span>
          <div className="flex items-center rounded border border-app-border bg-app-workspace p-0.5">
            <button
              type="button"
              onClick={() => setActiveSource('dumpv2.cs')}
              disabled={!artifacts?.hasDumpV2}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all flex items-center gap-1.5 ${
                activeSource === 'dumpv2.cs'
                  ? 'bg-accent text-white shadow-sm font-semibold'
                  : artifacts?.hasDumpV2
                  ? 'text-ink-secondary hover:text-ink-primary cursor-pointer'
                  : 'text-ink-muted/40 cursor-not-allowed opacity-50'
              }`}
              title={artifacts?.hasDumpV2 ? "Use dumpv2.cs (Includes full Hex-Rays method bodies)" : "dumpv2.cs not generated yet. Run ida_export_dumpv2.py in IDA to export!"}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>dumpv2.cs (Hex-Rays)</span>
              {artifacts?.hasDumpV2 && (
                <span className="px-1.5 py-0.2 rounded text-[10px] bg-white/20 text-white font-bold uppercase">Active</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveSource('dump.cs')}
              className={`px-3 py-1 rounded text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeSource === 'dump.cs'
                  ? 'bg-app-elevated text-ink-primary font-semibold'
                  : 'text-ink-secondary hover:text-ink-primary'
              }`}
              title="Use standard dump.cs (Signatures without bodies)"
            >
              <FileCode2 className="w-3.5 h-3.5" />
              <span>dump.cs (Standard)</span>
            </button>
          </div>
        </div>

        {artifacts?.hasDumpV2 ? (
          <div className="flex items-center gap-2.5 text-xs font-mono">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Hex-Rays Decompiled Active</span>
            </span>
            <span className="text-ink-muted text-[11px] hidden sm:inline">
              ({formatBytes(artifacts.dumpV2Size || 0)})
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-xs text-ink-secondary">
            <span>💡 Want to inspect method bodies? Run</span>
            <code className="text-accent bg-app-workspace px-1.5 py-0.5 rounded border border-app-border font-mono text-[11px]">ida_export_dumpv2.py</code>
            <span>in IDA Pro!</span>
          </div>
        )}
      </div>

      {/* In-Memory Indexing Status & On-Demand Activation Banner */}
      {indexingStatus && (
        <div className="p-3 rounded border border-app-border bg-[#17191C] space-y-2 select-none">
          {/* State 1: Idle (Index not activated yet - Prevents startup lag) */}
          {indexingStatus.phase === 'idle' && !indexingStatus.isIndexing ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded bg-[#1F2326] border border-app-border flex items-center justify-center text-[#C49B66] shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink-primary">
                      In-Memory Symbol Index ({activeSource})
                    </span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#1F2326] text-ink-muted border border-app-border">
                      Idle / Standby
                    </span>
                  </div>
                  <p className="text-[11px] text-ink-secondary mt-0.5">
                    Pre-loads ~302k methods into RAM for instant &lt;70ms deep queries. Click Active to index on demand without startup lag.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleActivateIndex(false)}
                disabled={isActivatingIndex}
                className="btn-primary-action px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-default shrink-0 shadow-sm disabled:opacity-50"
                title="Active in-memory indexing for instant symbol searching"
              >
                {isActivatingIndex ? (
                  <>
                    <RotateCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Activating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5 fill-current" />
                    <span>Active Search Index</span>
                  </>
                )}
              </button>
            </div>
          ) : indexingStatus.isIndexing ? (
            /* State 2: Indexing in progress (Real-time Progress Bar) */
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <RotateCw className="w-3.5 h-3.5 text-[#C49B66] animate-spin" />
                  <span className="font-semibold text-ink-primary">
                    Indexing {indexingStatus.targetFile}... ({indexingStatus.percent}%)
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-ink-secondary text-[11px]">
                  <span><strong>{indexingStatus.methodsCount.toLocaleString()}</strong> methods</span>
                  <span>•</span>
                  <span><strong>{indexingStatus.classesCount.toLocaleString()}</strong> classes</span>
                  <span>•</span>
                  <span><strong>{indexingStatus.fieldsCount.toLocaleString()}</strong> fields</span>
                </div>
              </div>

              <div className="w-full bg-[#121416] rounded-full h-2 overflow-hidden border border-app-border">
                <div
                  className="bg-gradient-to-r from-[#C49B66] to-[#6E9B7B] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${Math.max(4, indexingStatus.percent)}%` }}
                />
              </div>
            </div>
          ) : (
            /* State 3: Ready (Active) */
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-[#6E9B7B]" />
                <span className="font-semibold text-ink-primary">
                  In-Memory Index Active: {indexingStatus.targetFile}
                </span>
                <span className="text-[10px] bg-[#121416] px-1.5 py-0.2 rounded border border-app-border text-[#6E9B7B] font-semibold">
                  Online
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-ink-secondary text-[11px]">
                <span><strong>{indexingStatus.methodsCount.toLocaleString()}</strong> methods</span>
                <span>•</span>
                <span><strong>{indexingStatus.classesCount.toLocaleString()}</strong> classes</span>
                <span>•</span>
                <span><strong>{indexingStatus.fieldsCount.toLocaleString()}</strong> fields</span>
                {indexingStatus.tookMs > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-[#6E9B7B] font-semibold">{indexingStatus.tookMs}ms (Instant Search Active)</span>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => handleActivateIndex(true)}
                  className="btn-secondary-action px-2 py-0.5 text-[10px] ml-2 cursor-default font-mono"
                  title="Re-index dump file"
                >
                  <span>Re-Index</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

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
                ref={searchInputRef}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search symbol (e.g. SetVisible, radius, LobbyExtraCoinUI, HeroAvatarView)..."
                className="control-input w-full pl-8 pr-3 py-1.5 text-xs font-mono"
              />
              <Search className="w-3.5 h-3.5 text-ink-muted absolute left-2.5 top-2.5" />
            </div>

            {/* Type Filter Tabs */}
            <div className="flex items-center gap-1 bg-app-elevated p-0.5 rounded border border-app-border">
              {(['all', 'class', 'method', 'field', 'body'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSymbolTypeFilter(t);
                    if (searchQuery.length >= 2) handleSearch(undefined, t);
                  }}
                  className={`px-2.5 py-1 text-[11px] font-mono tracking-wider rounded transition-colors cursor-pointer ${
                    symbolTypeFilter === t
                      ? 'bg-accent text-app-bg font-semibold shadow-sm'
                      : 'text-ink-secondary hover:text-ink-primary'
                  }`}
                >
                  {t === 'all'
                    ? 'All Symbols'
                    : t === 'class'
                    ? 'Classes'
                    : t === 'method'
                    ? 'Methods'
                    : t === 'field'
                    ? 'Fields'
                    : 'Method Bodies'}
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
                            : item.symbolType === 'method-body'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                            : 'bg-app-elevated text-ink-primary border border-app-border'
                        }`}
                      >
                        {item.symbolType === 'method-body' ? 'Body Match' : item.symbolType}
                      </span>

                      {/* Symbol Name & Copy */}
                      <span className="text-xs font-mono font-semibold text-ink-primary select-text">
                        {item.name}
                      </span>
                      <button
                        onClick={() => copyToClipboard(item.name)}
                        className="p-1 rounded text-ink-muted hover:text-ink-primary cursor-pointer transition-colors"
                        title="Copy symbol name"
                      >
                        {copiedText === item.name ? <Check className="w-3 h-3 text-status-ready" /> : <Copy className="w-3 h-3" />}
                      </button>

                      {/* DLL Badge */}
                      <button
                        onClick={() => handleOpenDll(item.dll)}
                        className="text-[11px] font-mono text-ink-secondary bg-app-elevated px-2 py-0.5 rounded border border-app-border hover:border-accent hover:text-accent flex items-center gap-1 cursor-pointer transition-colors"
                        title="Open this Assembly in Inspector"
                      >
                        <Box className="w-3 h-3 text-accent" />
                        <span className="select-text">{item.dll}</span>
                      </button>

                      {/* Enclosing Class Badge */}
                      <div className="flex items-center bg-app-elevated rounded border border-app-border overflow-hidden">
                        <button
                          onClick={() => handleInspectClass(item.typeDefIndex, item.enclosingClass)}
                          className="text-[11px] font-mono text-ink-secondary px-2 py-0.5 hover:text-accent cursor-pointer transition-colors"
                          title="Inspect enclosing class"
                        >
                          Class: <span className="font-semibold text-ink-primary select-text">{item.enclosingClass}</span>
                        </button>
                        <button
                          onClick={() => copyToClipboard(item.enclosingClass)}
                          className="p-1 text-ink-muted hover:text-ink-primary cursor-pointer border-l border-app-border/40"
                          title="Copy class name"
                        >
                          {copiedText === item.enclosingClass ? <Check className="w-2.5 h-2.5 text-status-ready" /> : <Copy className="w-2.5 h-2.5" />}
                        </button>
                      </div>

                      {/* Parent Class (Class cha) */}
                      {item.baseClass && (
                        <div className="flex items-center bg-app-bg rounded border border-app-border overflow-hidden">
                          <button
                            onClick={() => handleInspectClass(undefined, item.baseClass!)}
                            className="text-[11px] font-mono text-ink-muted px-2 py-0.5 hover:text-ink-primary cursor-pointer transition-colors"
                            title="Jump to Base Class (Class cha)"
                          >
                            Base: <span className="text-ink-secondary select-text">{item.baseClass}</span>
                          </button>
                          <button
                            onClick={() => copyToClipboard(item.baseClass!)}
                            className="p-1 text-ink-muted hover:text-ink-primary cursor-pointer border-l border-app-border/40"
                            title="Copy base class name"
                          >
                            {copiedText === item.baseClass ? <Check className="w-2.5 h-2.5 text-status-ready" /> : <Copy className="w-2.5 h-2.5" />}
                          </button>
                        </div>
                      )}

                      {/* Derived Classes (Class con) */}
                      {item.childCount > 0 && (
                        <span className="text-[10px] font-mono text-status-ready bg-status-ready/10 px-1.5 py-0.5 rounded border border-status-ready/30 select-text">
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
                          <span className="select-text">{item.rva}</span>
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

                  {/* Signature Code Box with One-Click Copy */}
                  <div className="relative group">
                    <div className="font-mono text-xs text-ink-primary bg-app-bg px-3 py-2 pr-16 rounded border border-app-border/60 overflow-x-auto whitespace-pre select-text">
                      {item.signature}
                    </div>
                    <button
                      onClick={() => copyToClipboard(item.signature)}
                      className="absolute right-2 top-2 px-2 py-0.5 rounded text-[10px] font-mono bg-app-elevated hover:bg-app-elevatedHover border border-app-border text-ink-secondary hover:text-ink-primary cursor-pointer transition-colors flex items-center gap-1 shadow-sm"
                      title="Copy full signature"
                    >
                      {copiedText === item.signature ? (
                        <>
                          <Check className="w-3 h-3 text-status-ready" />
                          <span className="text-status-ready">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy</span>
                        </>
                      )}
                    </button>
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
                            <span className="text-ink-primary select-text">
                              {item.parameters.map((p) => `${p.type} ${p.name}`).join(', ')}
                            </span>
                          )}
                          {item.paramCount > 0 && (
                            <button
                              onClick={() => copyToClipboard(item.parameters.map((p) => `${p.type} ${p.name}`).join(', '))}
                              className="p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
                              title="Copy parameters string"
                            >
                              <Copy className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </div>
                        {item.returnType && (
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted">Return:</span>
                            <span className="text-ink-primary select-text">{item.returnType}</span>
                          </div>
                        )}
                        {item.offset && (
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted">File Offset:</span>
                            <button
                              onClick={() => copyToClipboard(item.offset!)}
                              className="text-accent hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                              title="Click to copy file offset"
                            >
                              <span className="select-text">{item.offset}</span>
                              <Copy className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          </div>
                        )}
                      </>
                    ) : item.symbolType === 'field' ? (
                      <>
                        <div className="flex items-center gap-1">
                          <span className="text-ink-muted">Field Type:</span>
                          <span className="text-ink-primary select-text">{item.fieldType || item.returnType}</span>
                          <button
                            onClick={() => copyToClipboard(item.fieldType || item.returnType || '')}
                            className="p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
                            title="Copy field type"
                          >
                            <Copy className="w-2.5 h-2.5" />
                          </button>
                        </div>
                        {(item.fieldOffset || item.offset) && (
                          <div className="flex items-center gap-1">
                            <span className="text-ink-muted">Memory Offset:</span>
                            <button
                              onClick={() => copyToClipboard(item.fieldOffset || item.offset!)}
                              className="text-accent hover:underline flex items-center gap-0.5 cursor-pointer font-semibold"
                              title="Click to copy memory offset"
                            >
                              <span className="select-text">{item.fieldOffset || item.offset}</span>
                              <Copy className="w-2.5 h-2.5 opacity-70" />
                            </button>
                          </div>
                        )}
                        <div className="flex items-center gap-1">
                          <span className="text-ink-muted">Access:</span>
                          <span className="text-ink-primary select-text">{item.access}</span>
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

      {/* IDA Pro & Ghidra Mapping Scripts Panel */}
      <section className="panel-frame">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              IDA Pro & Ghidra Mapping Scripts (Auto-Symbolizer & Struct Typer)
            </h3>
          </div>
          <span className="text-[11px] text-accent font-mono font-medium hidden sm:inline">
            Auto-symbolize functions & inject structures into libil2cpp.so
          </span>
        </div>

        <div className="p-3.5 space-y-3">
          {/* Quick Guide Box */}
          <div className="p-3 rounded bg-app-subtle border border-app-border space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-accent">
              <Sparkles className="w-3.5 h-3.5" />
              <span>3-STEP GUIDE TO MAP NAMES & STRUCTS IN IDA PRO:</span>
            </div>
            <ol className="text-xs text-ink-secondary space-y-1.5 pl-4 list-decimal font-mono">
              <li>
                <span className="font-semibold text-ink-primary">Open libil2cpp.so</span> in IDA Pro (64-bit ARM64 ELF). Wait for initial auto-analysis to finish (bottom status bar shows <code className="px-1 py-0.5 rounded bg-app-elevated border border-app-border text-accent">AU: idle</code>).
              </li>
              <li>
                Press <kbd className="px-1.5 py-0.5 rounded bg-app-elevated border border-app-border text-ink-primary font-bold">Alt + F7</kbd> (or navigate to <code className="text-ink-primary">File -&gt; Script file...</code>).
              </li>
              <li>
                Select <span className="text-accent font-bold">ida_ultimate_il2cpp.py</span> (Supreme Engine ⭐⭐⭐) or <code className="text-ink-primary">ida_with_struct_py3.py</code> in output folder to inject structures, rename methods, auto-cast this, and inline string literals.
              </li>
              <li>
                To export all decompiled C# method bodies into <span className="text-accent font-bold">dumpv2.cs</span>, run <span className="text-accent font-bold">ida_export_dumpv2.py</span>. The script uses Hex-Rays to decompile methods from dump.cs, normalizes IDB names, and writes dumpv2.cs.
              </li>
            </ol>
          </div>

          {/* Script Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {[
              {
                fileName: 'ida_ultimate_il2cpp.py',
                title: 'IDA Pro Ultimate Engine (Supreme ⭐⭐⭐)',
                desc: 'Premier Decompiler: Fault-tolerant header chunker, inline string Xrefs in Hex-Rays F5, auto-cast this to struct & strip MethodInfo params.',
                tag: 'Python 3 / IDA 7.x-9.x',
                badge: 'Supreme ⚡',
                badgeStyle: 'bg-[#C49B66]/15 text-[#C49B66] border border-[#C49B66]/30',
                isHot: true,
              },
              {
                fileName: 'ida_export_dumpv2.py',
                title: 'Export Full Method Bodies to dumpv2.cs (Hex-Rays 🚀)',
                desc: 'Automatically decompiles all functions in dump.cs via Hex-Rays, normalizes IDB names, and generates dumpv2.cs with full C# method bodies.',
                tag: 'Python 3 / Hex-Rays F5',
                badge: 'DumpV2 Engine ⚡',
                badgeStyle: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                isHot: true,
              },
              {
                fileName: 'ida_with_struct_py3.py',
                title: 'IDA Pro with Structs (Standard Recommended ⭐)',
                desc: 'Parses script.json & loads il2cpp.h into IDA Type Engine. Auto-renames methods, parameter types, structs, and string literals.',
                tag: 'Python 3 / IDA 7.x-9.x',
                badge: 'Recommended ⭐',
                badgeStyle: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
                isHot: false,
              },
              {
                fileName: 'ida_py3.py',
                title: 'IDA Pro Basic Script',
                desc: 'Quickly renames methods and strings from script.json without requiring C structs.',
                tag: 'Python 3 / IDA 7.x-9.x',
                badge: 'Standard',
                badgeStyle: 'bg-[#1F2326] text-[#9FA6A2] border border-[#2C3236]',
                isHot: false,
              },
              {
                fileName: 'ghidra_with_struct.py',
                title: 'Ghidra with Structs',
                desc: 'Imports struct definitions from il2cpp.h and maps symbols from script.json into Ghidra 10.x / 11.x.',
                tag: 'Ghidra Script',
                badge: 'Ghidra',
                badgeStyle: 'bg-purple-500/15 text-purple-400 border border-purple-500/30',
                isHot: false,
              },
            ].map((script) => {
              const scriptPath = artifacts?.directory ? `${artifacts.directory}\\${script.fileName}` : script.fileName;
              const matched = artifacts?.artifacts.find((a) => a.name === script.fileName);
              return (
                <div
                  key={script.fileName}
                  className={`p-3.5 rounded border flex flex-col justify-between space-y-3 transition-colors overflow-hidden ${
                    script.isHot
                      ? 'bg-accent/5 border-accent/40 shadow-sm'
                      : 'bg-app-workspace border-app-border hover:border-app-border-hover'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Terminal className={`w-3.5 h-3.5 shrink-0 ${script.isHot ? 'text-accent' : 'text-ink-secondary'}`} />
                        <span className="text-xs font-mono font-bold text-ink-primary truncate" title={script.fileName}>
                          {script.fileName}
                        </span>
                      </div>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold whitespace-nowrap shrink-0 ${script.badgeStyle}`}
                      >
                        {script.badge}
                      </span>
                    </div>

                    <p className="text-[11px] text-ink-secondary leading-relaxed line-clamp-3">{script.desc}</p>
                    <div className="text-[10px] font-mono text-ink-muted">
                      {matched ? `Size: ${formatBytes(matched.size)}` : 'Ready in output folder'}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-app-border/60">
                    <button
                      onClick={() => copyToClipboard(scriptPath)}
                      className="btn-secondary-action flex-1 py-1 text-xs flex items-center justify-center gap-1.5 cursor-pointer font-medium"
                      title={scriptPath}
                    >
                      {copiedText === scriptPath ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400 font-semibold">Copied Path!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3 text-ink-secondary" />
                          <span>Copy Script Path</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={onOpenFolder}
                      className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1 cursor-pointer font-medium"
                      title="Open enclosing folder"
                    >
                      <FolderOpen className="w-3.5 h-3.5 text-accent" />
                    </button>
                  </div>
                </div>
              );
            })}
                    </div>
        </div>
      </section>

          </div>
  );
};
