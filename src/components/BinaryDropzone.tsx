import React, { useState } from 'react';
import { Binary, FileCode, Folder, Database, FolderOpen, Loader2, Copy, Check } from 'lucide-react';
import { apiUrl } from '../config';

interface BinaryDropzoneProps {
  elfPath: string;
  setElfPath: (path: string) => void;
  metadataPath: string;
  setMetadataPath: (path: string) => void;
  outputDir: string;
  setOutputDir: (path: string) => void;
  onLoadDefaults: () => void;
  elfExists: boolean;
  metadataExists: boolean;
}

export const BinaryDropzone: React.FC<BinaryDropzoneProps> = ({
  elfPath,
  setElfPath,
  metadataPath,
  setMetadataPath,
  outputDir,
  setOutputDir,
  onLoadDefaults,
  elfExists,
  metadataExists,
}) => {
  const [browsingTarget, setBrowsingTarget] = useState<'elf' | 'meta' | 'out' | null>(null);
  const [dragOverElf, setDragOverElf] = useState(false);
  const [dragOverMeta, setDragOverMeta] = useState(false);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  const copyPath = (text: string, targetId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTarget(targetId);
    setTimeout(() => setCopiedTarget(null), 2000);
  };

  const handleBrowseFile = async (target: 'elf' | 'meta') => {
    setBrowsingTarget(target);
    try {
      const isElf = target === 'elf';
      if (window.electronAPI) {
        const result = await window.electronAPI.browseFile({
          title: isElf ? 'Select ELF Binary (libil2cpp.so)' : 'Select Global Metadata (global-metadata.dat)',
          filter: isElf
            ? [{ name: 'ELF Binary', extensions: ['so', 'dll', 'exe'] }, { name: 'All Files', extensions: ['*'] }]
            : [{ name: 'Unity Metadata', extensions: ['dat'] }, { name: 'All Files', extensions: ['*'] }]
        });
        if (result.selectedPath) {
          if (isElf) setElfPath(result.selectedPath);
          else setMetadataPath(result.selectedPath);
        }
      } else {
        const res = await fetch(apiUrl('/api/browse-file'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: isElf ? 'Select ELF Binary (libil2cpp.so)' : 'Select Global Metadata (global-metadata.dat)',
            filter: isElf
              ? 'ELF Binary (*.so;*.dll;*.exe)|*.so;*.dll;*.exe|All Files (*.*)|*.*'
              : 'Unity Metadata (*.dat)|*.dat|All Files (*.*)|*.*',
            initialDir: isElf ? elfPath : metadataPath,
          }),
        });
        const data = await res.json();
        if (data.selectedPath) {
          if (isElf) setElfPath(data.selectedPath);
          else setMetadataPath(data.selectedPath);
        }
      }
    } catch (err) {
      console.error('Failed to browse file:', err);
    } finally {
      setBrowsingTarget(null);
    }
  };

  const handleBrowseFolder = async () => {
    setBrowsingTarget('out');
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.browseFolder({
          title: 'Select Destination Directory for Decompiled Output'
        });
        if (result.selectedPath) {
          setOutputDir(result.selectedPath);
        }
      } else {
        const res = await fetch(apiUrl('/api/browse-folder'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Select Destination Directory for Decompiled Output',
            initialDir: outputDir,
          }),
        });
        const data = await res.json();
        if (data.selectedPath) {
          setOutputDir(data.selectedPath);
        }
      }
    } catch (err) {
      console.error('Failed to browse folder:', err);
    } finally {
      setBrowsingTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, target: 'elf' | 'meta') => {
    e.preventDefault();
    if (target === 'elf') setDragOverElf(false);
    else setDragOverMeta(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      // If path available (e.g. Electron or local drop)
      const file = files[0];
      const filePath = (file as unknown as { path?: string }).path || file.name;
      if (target === 'elf') setElfPath(filePath);
      else setMetadataPath(filePath);
    }
  };

  return (
    <section className="panel-frame">
      {/* Panel Toolbar Header */}
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
            Input Targets & Mount Paths
          </h2>
        </div>
        <button
          onClick={onLoadDefaults}
          className="btn-secondary-action px-2.5 py-1 text-xs flex items-center gap-1.5 cursor-pointer font-medium"
        >
          <span>Use Workspace Defaults</span>
        </button>
      </div>

      <div className="p-3.5 space-y-3">
        {/* Dual Input Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Target 1: ELF Binary */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOverElf(true); }}
            onDragLeave={() => setDragOverElf(false)}
            onDrop={(e) => handleDrop(e, 'elf')}
            className={`border rounded p-3 space-y-2 transition-colors ${
              dragOverElf
                ? 'bg-app-elevated border-accent'
                : 'bg-app-elevated/40 border-app-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Binary className="w-4 h-4 text-ink-secondary" />
                <div>
                  <div className="text-xs font-medium text-ink-primary">ELF Binary</div>
                  <div className="text-[11px] text-ink-secondary">libil2cpp.so (ARM64)</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span
                  className={`w-2 h-2 rounded-full inline-block ${
                    elfExists ? 'bg-status-ready' : 'bg-status-error'
                  }`}
                />
                <span className={elfExists ? 'text-status-ready' : 'text-status-error'}>
                  {elfExists ? 'Mounted' : 'Unresolved'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={elfPath}
                onChange={(e) => setElfPath(e.target.value)}
                placeholder="Full path to libil2cpp.so"
                className="control-input flex-1 px-2.5 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => copyPath(elfPath, 'elf')}
                className="btn-secondary-action p-1.5 text-xs shrink-0 cursor-pointer"
                title="Copy binary path"
              >
                {copiedTarget === 'elf' ? <Check className="w-3.5 h-3.5 text-status-ready" /> : <Copy className="w-3.5 h-3.5 text-ink-secondary" />}
              </button>
              <button
                type="button"
                onClick={() => handleBrowseFile('elf')}
                disabled={browsingTarget === 'elf'}
                className="btn-secondary-action px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                title="Browse for libil2cpp.so on Windows"
              >
                {browsingTarget === 'elf' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-accent" />
                )}
                <span>Browse...</span>
              </button>
            </div>
          </div>

          {/* Target 2: Global Metadata */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOverMeta(true); }}
            onDragLeave={() => setDragOverMeta(false)}
            onDrop={(e) => handleDrop(e, 'meta')}
            className={`border rounded p-3 space-y-2 transition-colors ${
              dragOverMeta
                ? 'bg-app-elevated border-accent'
                : 'bg-app-elevated/40 border-app-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-ink-secondary" />
                <div>
                  <div className="text-xs font-medium text-ink-primary">Global Metadata</div>
                  <div className="text-[11px] text-ink-secondary">global-metadata.dat</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[11px]">
                <span
                  className={`w-2 h-2 rounded-full inline-block ${
                    metadataExists ? 'bg-status-ready' : 'bg-status-error'
                  }`}
                />
                <span className={metadataExists ? 'text-status-ready' : 'text-status-error'}>
                  {metadataExists ? 'Mounted' : 'Unresolved'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={metadataPath}
                onChange={(e) => setMetadataPath(e.target.value)}
                placeholder="Full path to global-metadata.dat"
                className="control-input flex-1 px-2.5 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => copyPath(metadataPath, 'meta')}
                className="btn-secondary-action p-1.5 text-xs shrink-0 cursor-pointer"
                title="Copy metadata path"
              >
                {copiedTarget === 'meta' ? <Check className="w-3.5 h-3.5 text-status-ready" /> : <Copy className="w-3.5 h-3.5 text-ink-secondary" />}
              </button>
              <button
                type="button"
                onClick={() => handleBrowseFile('meta')}
                disabled={browsingTarget === 'meta'}
                className="btn-secondary-action px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                title="Browse for global-metadata.dat on Windows"
              >
                {browsingTarget === 'meta' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
                ) : (
                  <FolderOpen className="w-3.5 h-3.5 text-accent" />
                )}
                <span>Browse...</span>
              </button>
            </div>
          </div>
        </div>

        {/* Output Directory Row */}
        <div className="bg-app-elevated/20 border border-app-border rounded p-2.5 flex flex-col sm:flex-row items-start sm:items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-ink-secondary text-xs font-medium min-w-[130px] shrink-0">
            <Folder className="w-3.5 h-3.5 text-ink-muted" />
            <span>Output Directory:</span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 w-full">
            <input
              type="text"
              value={outputDir}
              onChange={(e) => setOutputDir(e.target.value)}
              placeholder="Destination directory path"
              className="control-input flex-1 px-2.5 py-1.5 text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => copyPath(outputDir, 'out')}
              className="btn-secondary-action p-1.5 text-xs shrink-0 cursor-pointer"
              title="Copy output directory path"
            >
              {copiedTarget === 'out' ? <Check className="w-3.5 h-3.5 text-status-ready" /> : <Copy className="w-3.5 h-3.5 text-ink-secondary" />}
            </button>
            <button
              type="button"
              onClick={handleBrowseFolder}
              disabled={browsingTarget === 'out'}
              className="btn-secondary-action px-2.5 py-1.5 text-xs font-medium flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              title="Browse for output directory on Windows"
            >
              {browsingTarget === 'out' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              ) : (
                <FolderOpen className="w-3.5 h-3.5 text-accent" />
              )}
              <span>Browse Folder...</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
