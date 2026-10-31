import { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { BinaryDropzone } from './components/BinaryDropzone';
import { EngineConfig } from './components/EngineConfig';
import { TerminalView } from './components/TerminalView';
import { ArtifactsExplorer } from './components/ArtifactsExplorer';
import type { DumperConfig, SystemStatus, LogEntry, ArtifactData } from './types';
import { Play, Square, FolderOpen, Check, Loader2 } from 'lucide-react';
import { apiUrl } from './config';

export function App() {
  const [activeTab, setActiveTab] = useState<'dump' | 'artifacts'>('dump');
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

  // Artifacts
  const [artifacts, setArtifacts] = useState<ArtifactData | null>(null);

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

    return () => {
      if (eventSource) eventSource.close();
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
    <div className="min-h-screen bg-app-bg text-ink-primary flex flex-col font-sans select-text">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isRunning={isRunning}
        totalDlls={artifacts?.totalDlls || 89}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 space-y-4">
        {activeTab === 'dump' ? (
          <div className="space-y-4">
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
            <section className="panel-frame p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-app-panel">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExecuteDump}
                  disabled={isRunning}
                  className={`px-4 py-2 text-xs font-semibold flex items-center justify-center gap-2 rounded transition-colors cursor-pointer ${
                    isRunning
                      ? 'bg-app-elevated text-ink-muted cursor-not-allowed border border-app-border'
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
                    className="px-3 py-2 rounded border border-status-error text-status-error hover:bg-status-error/10 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
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
                  className="btn-secondary-action px-3 py-2 text-xs font-medium flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Open decompiled output folder in Windows Explorer"
                >
                  {folderOpened ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-status-ready" />
                      <span className="text-status-ready font-medium">Opened in Explorer</span>
                    </>
                  ) : isOpeningFolder ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                      <span>Opening...</span>
                    </>
                  ) : (
                    <>
                      <FolderOpen className="w-3.5 h-3.5 text-accent" />
                      <span>Open Destination Folder</span>
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
        ) : (
          <ArtifactsExplorer
            artifacts={artifacts}
            onRefresh={fetchArtifacts}
            onOpenFolder={handleOpenFolder}
          />
        )}
      </main>

      <footer className="border-t border-app-border py-2 px-4 text-center text-[11px] font-mono text-ink-muted bg-app-panel">
        <span>IL2CPPDUMPER WORKSTATION • REVERSE ENGINEERING SUITE • TENCENT XOR 0x69696969 ACTIVE</span>
      </footer>
    </div>
  );
}

export default App;
