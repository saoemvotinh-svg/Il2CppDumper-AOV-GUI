import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BinaryDropzone } from './components/BinaryDropzone';
import { EngineConfig } from './components/EngineConfig';
import { TerminalView } from './components/TerminalView';
import { ArtifactsExplorer } from './components/ArtifactsExplorer';
import { MetadataFixer } from './components/MetadataFixer';
import type { DumperConfig, SystemStatus, LogEntry, ArtifactData, IndexingStatus } from './types';
import { Play, Square, FolderOpen, Check, Loader2 } from 'lucide-react';
import { apiUrl } from './config';
import { formatBytes } from './lib/utils';

export function App() {
  const [activeTab, setActiveTab] = useState<'dump' | 'artifacts' | 'fix-metadata'>('dump');
  const [isRunning, setIsRunning] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [folderOpened, setFolderOpened] = useState(false);
  const [isOpeningFolder, setIsOpeningFolder] = useState(false);

  // Paths
  const [elfPath, setElfPath] = useState('');
  const [metadataPath, setMetadataPath] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [elfExists, setElfExists] = useState(false);
  const [metadataExists, setMetadataExists] = useState(false);

  // Artifacts & In-Memory Index Status
  const [artifacts, setArtifacts] = useState<ArtifactData | null>(null);
  const [indexingStatus, setIndexingStatus] = useState<IndexingStatus | null>(null);

  // Config
  const [config, setConfig] = useState<DumperConfig>({
    DumpMethod: true,
    DumpField: true,
    DumpProperty: false,
    DumpAttribute: false,
    DumpFieldOffset: true,
    DumpMethodOffset: true,
    DumpTypeDefIndex: true,
    GenerateDummyDll: true,
    GenerateScript: true,
    DummyDllAddToken: true,
    RequireAnyKey: false,
    autoTencentXor: true,
  });

  // Global desktop event prevention & keyboard shortcuts
  useEffect(() => {
    // Prevent Chromium from navigating when files are dragged into the window
    const handleDragOver = (e: DragEvent) => e.preventDefault();
    const handleDrop = (e: DragEvent) => e.preventDefault();

    // Desktop keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '1') {
        e.preventDefault();
        setActiveTab('dump');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '2') {
        e.preventDefault();
        setActiveTab('artifacts');
      } else if ((e.ctrlKey || e.metaKey) && e.key === '3') {
        e.preventDefault();
        setActiveTab('fix-metadata');
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        handleOpenFolder();
      }
    };

    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [outputDir]);

  // Fetch status on mount
  useEffect(() => {
    fetchStatus();
    fetchArtifacts();

    // Setup SSE connection
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(apiUrl('/api/stream'));
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLogs((prev) => [...prev, data]);
          if (data.line.includes('completed successfully') || data.line.includes('Done!')) {
            setIsRunning(false);
            fetchArtifacts();
          }
        } catch (err) {
          console.error('SSE parse error:', err);
        }
      };
      eventSource.onerror = (err) => {
        console.warn('SSE stream disconnected or reconnecting:', err);
      };
    } catch (e) {
      console.warn('Could not connect EventSource:', e);
    }

    // Poll indexing status
    const pollIndexing = async () => {
      try {
        const res = await fetch(apiUrl('/api/indexing-status'));
        if (res.ok) {
          const data: IndexingStatus = await res.json();
          setIndexingStatus(data);
        }
      } catch {}
    };

    pollIndexing();
    const interval = setInterval(pollIndexing, 1500);

    return () => {
      if (eventSource) eventSource.close();
      clearInterval(interval);
    };
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch(apiUrl('/api/status'));
      const data: SystemStatus = await res.json();
      setIsRunning(data.isRunning);
      setElfPath(data.defaults.elfPath);
      setMetadataPath(data.defaults.metadataPath);
      setOutputDir(data.defaults.outputDir);
      setElfExists(data.defaults.elfExists);
      setMetadataExists(data.defaults.metadataExists);
    } catch (err) {
      console.warn('Backend not ready yet:', err);
    }
  };

  const fetchArtifacts = async () => {
    try {
      const res = await fetch(apiUrl(`/api/artifacts?dir=${encodeURIComponent(outputDir || '')}`));
      const data = await res.json();
      setArtifacts(data);
    } catch (err) {
      console.warn('Could not fetch artifacts:', err);
    }
  };

  const handleExecuteDump = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setLogs([]);

    try {
      const res = await fetch(apiUrl('/api/dump'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elfPath,
          metadataPath,
          outputDir,
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to start dump');
        setIsRunning(false);
      }
    } catch (err) {
      alert(`Network error starting dump: ${err}`);
      setIsRunning(false);
    }
  };

  const handleCancelDump = async () => {
    try {
      await fetch(apiUrl('/api/cancel'), { method: 'POST' });
      setIsRunning(false);
    } catch (err) {
      console.error('Failed to cancel:', err);
    }
  };

  const handleOpenFolder = async () => {
    setIsOpeningFolder(true);
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.openFolder(outputDir);
        if (result.success) {
          setFolderOpened(true);
          setTimeout(() => setFolderOpened(false), 2500);
        } else {
          alert(result.error || 'Failed to open directory');
        }
      } else {
        const res = await fetch(apiUrl('/api/open-folder'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dir: outputDir }),
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setFolderOpened(true);
          setTimeout(() => setFolderOpened(false), 2500);
        } else {
          alert(data.error || 'Failed to open directory');
        }
      }
    } catch (err) {
      console.error('Failed to open folder:', err);
      alert(`Could not open directory: ${err}`);
    } finally {
      setIsOpeningFolder(false);
    }
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-[#121416] text-[#E6E8E6] flex flex-col font-sans select-none">
      {/* Native Desktop Window Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRunning={isRunning}
        totalDlls={artifacts?.totalDlls || 89}
      />

      {/* Main Workspace Area - Full-bleed Desktop Layout */}
      <main className="flex-1 w-full overflow-y-auto px-3 py-2.5 flex flex-col">
        {activeTab === 'dump' ? (
          <div className="space-y-3 max-w-full">
            {/* Input Selection Card */}
            <BinaryDropzone
              elfPath={elfPath}
              setElfPath={setElfPath}
              metadataPath={metadataPath}
              setMetadataPath={setMetadataPath}
              outputDir={outputDir}
              setOutputDir={setOutputDir}
              onLoadDefaults={fetchStatus}
              elfExists={elfExists}
              metadataExists={metadataExists}
            />

            {/* Reconstruction Options */}
            <EngineConfig config={config} setConfig={setConfig} />

            {/* Execution Control Dock */}
            <section className="panel-frame p-2.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-[#17191C]">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExecuteDump}
                  disabled={isRunning}
                  className={`px-4 py-1.5 text-xs font-semibold flex items-center justify-center gap-2 rounded-[3px] transition-colors cursor-default ${
                    isRunning
                      ? 'bg-[#1F2326] text-[#676E6A] cursor-not-allowed border border-[#2C3236]'
                      : 'btn-primary-action'
                  }`}
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isRunning ? 'Decompiling Process Active...' : 'Execute Decompilation'}</span>
                </button>

                {isRunning && (
                  <button
                    type="button"
                    onClick={handleCancelDump}
                    className="px-3 py-1.5 rounded-[3px] border border-[#D96563] text-[#D96563] hover:bg-[#D96563]/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-default"
                  >
                    <Square className="w-3 h-3 fill-current" />
                    <span>Stop Pipeline</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleOpenFolder}
                  disabled={isOpeningFolder}
                  className="btn-secondary-action px-3 py-1.5 text-xs font-medium flex items-center justify-center gap-1.5 cursor-default disabled:opacity-50"
                  title="Open decompiled output folder in Windows Explorer (Ctrl+O)"
                >
                  {folderOpened ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#6E9B7B]" />
                      <span className="text-[#6E9B7B] font-medium">Opened in Explorer</span>
                    </>
                  ) : isOpeningFolder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-3.5 h-3.5 text-[#C49B66]" />
                      <span>Open Destination Folder</span>
                      <span className="text-[10px] text-[#676E6A] font-mono ml-1">Ctrl+O</span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Diagnostic Terminal View */}
            <TerminalView
              logs={logs}
              isRunning={isRunning}
              onClear={() => setLogs([])}
              autoScroll={autoScroll}
              setAutoScroll={setAutoScroll}
            />
          </div>
        ) : activeTab === 'artifacts' ? (
          <div className="flex-1 flex flex-col h-full">
            <ArtifactsExplorer
              artifacts={artifacts}
              onRefresh={fetchArtifacts}
              onOpenFolder={handleOpenFolder}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col h-full">
            <MetadataFixer
              onSwitchToPipeline={(newMeta) => {
                if (newMeta) {
                  setMetadataPath(newMeta);
                  setMetadataExists(true);
                }
                setActiveTab('dump');
              }}
              onRefreshArtifacts={fetchArtifacts}
            />
          </div>
        )}
      </main>

      {/* Native Desktop Status Bar (Visual Studio / IDA Pro style) */}
      <footer className="h-6 bg-[#121416] border-t border-[#2C3236] px-3 flex items-center justify-between text-[11px] font-mono text-[#676E6A] select-none z-20 shrink-0">
        {/* Left: Status & Engine info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isRunning
                  ? 'bg-[#D9A84E] animate-ping'
                  : indexingStatus?.isIndexing
                  ? 'bg-[#C49B66] animate-pulse'
                  : 'bg-[#6E9B7B]'
              }`}
            />
            <span className="font-semibold text-[#E6E8E6] uppercase tracking-wide">
              {isRunning
                ? 'PIPELINE ACTIVE'
                : indexingStatus?.isIndexing
                ? `INDEXING ${indexingStatus.percent}%`
                : 'READY'}
            </span>
          </div>
          <span className="text-[#2C3236]">|</span>
          <span className="text-[#9FA6A2]">
            Source: <strong className="text-[#C49B66]">{artifacts?.hasDumpV2 ? 'dumpv2.cs' : 'dump.cs'}</strong>
          </span>
          {artifacts?.dumpV2Size ? (
            <span className="text-[#676E6A]">({formatBytes(artifacts.dumpV2Size)})</span>
          ) : artifacts?.dumpCsSize ? (
            <span className="text-[#676E6A]">({formatBytes(artifacts.dumpCsSize)})</span>
          ) : null}
        </div>

        {/* Middle: Architecture & Decryption Specification */}
        <div className="hidden md:flex items-center gap-2.5">
          <span>Arch: <strong className="text-[#E6E8E6]">ARM64-v8a</strong></span>
          <span className="text-[#2C3236]">•</span>
          <span>Metadata: <strong className="text-[#E6E8E6]">v29 (EA/FA)</strong></span>
          <span className="text-[#2C3236]">•</span>
          <span className="text-[#6E9B7B] font-medium">Tencent XOR Active</span>
        </div>

        {/* Right: Metrics & Shortcuts */}
        <div className="flex items-center gap-2.5">
          {indexingStatus?.phase === 'ready' && (
            <>
              <span className="text-[#9FA6A2]">
                <strong className="text-[#E6E8E6]">{indexingStatus.methodsCount.toLocaleString()}</strong> methods
              </span>
              <span className="text-[#2C3236]">•</span>
              <span className="text-[#9FA6A2]">
                <strong className="text-[#E6E8E6]">{indexingStatus.classesCount.toLocaleString()}</strong> classes
              </span>
              <span className="text-[#2C3236]">•</span>
            </>
          )}
          <span className="text-[#9FA6A2]">
            RAM: <strong className="text-[#E6E8E6]">~189 MB</strong>
          </span>
          <span className="text-[#2C3236]">•</span>
          <span className="text-[#676E6A] hover:text-[#9FA6A2] transition-colors cursor-default" title="Ctrl+1: Pipeline | Ctrl+2: Explorer | Ctrl+3: Metadata | Ctrl+O: Folder">
            Ctrl+1/2/3 • Ctrl+O
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
