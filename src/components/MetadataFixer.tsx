import React, { useState, useEffect } from 'react';
import {
  Wrench,
  Binary,
  Database,
  Search,
  Check,
  Copy,
  FolderOpen,
  Folder,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  AlertTriangle,
  RotateCw,
  FolderCheck,
  CheckCircle2,
  FileCheck2
} from 'lucide-react';
import { apiUrl } from '../config';
import { formatBytes } from '../lib/utils';
import type { HeaderCandidate, FixMetadataResult } from '../types';

interface MetadataFixerProps {
  onSwitchToPipeline: (newMetadataPath?: string) => void;
  onRefreshArtifacts: () => void;
}

export const MetadataFixer: React.FC<MetadataFixerProps> = ({
  onSwitchToPipeline,
  onRefreshArtifacts,
}) => {
  // Input file paths
  const [dumpPath, setDumpPath] = useState('');
  const [metadataPath, setMetadataPath] = useState('');
  const [outputPath, setOutputPath] = useState('');

  // Options
  const [patchEaToFa, setPatchEaToFa] = useState(true); // Mặc định tích sẵn theo yêu cầu
  const [setAsActive, setSetAsActive] = useState(true); // Mặc định đặt làm metadata active

  // State
  const [candidates, setCandidates] = useState<HeaderCandidate[]>([]);
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState<number>(0);
  const [isScanning, setIsScanning] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [fixResult, setFixResult] = useState<FixMetadataResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<string | null>(null);

  // Load defaults on mount
  useEffect(() => {
    loadDefaults();
  }, []);

  const copyPath = (text: string, targetId: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTarget(targetId);
    setTimeout(() => setCopiedTarget(null), 2000);
  };

  const loadDefaults = async () => {
    setErrorMsg(null);
    try {
      const res = await fetch(apiUrl('/api/fix-metadata/defaults'));
      const data = await res.json();
      if (data.dumpPath) setDumpPath(data.dumpPath);
      if (data.metadataPath) setMetadataPath(data.metadataPath);
      if (data.outputPath) setOutputPath(data.outputPath);

      // If dumpPath exists, automatically scan it
      if (data.dumpPath && data.dumpExists) {
        scanDumpFile(data.dumpPath);
      }
    } catch (err) {
      console.warn('Failed to load metadata fixer defaults:', err);
    }
  };

  // Browse File Handler
  const handleBrowseFile = async (target: 'dump' | 'meta') => {
    try {
      if (window.electronAPI) {
        const title =
          target === 'dump'
            ? 'Select Memory Dump File (*.bin, *.dat)'
            : 'Select Target global-metadata.dat';
        const filter =
          target === 'dump'
            ? [{ name: 'Memory Dump (*.bin, *.dat)', extensions: ['bin', 'dat', 'raw', 'dump'] }, { name: 'All Files', extensions: ['*'] }]
            : [{ name: 'Metadata (*.dat)', extensions: ['dat', 'bin'] }, { name: 'All Files', extensions: ['*'] }];

        const result = await window.electronAPI.browseFile({ title, filter });
        if (result.selectedPath) {
          if (target === 'dump') {
            setDumpPath(result.selectedPath);
            scanDumpFile(result.selectedPath);
          } else {
            setMetadataPath(result.selectedPath);
          }
        }
      } else {
        const isDump = target === 'dump';
        const res = await fetch(apiUrl('/api/browse-file'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: isDump ? 'Select Memory Dump File (*.bin, *.dat)' : 'Select Target Metadata File (*.dat)',
            extensions: isDump ? ['bin', 'dat', 'raw', 'dump'] : ['dat', 'bin']
          })
        });
        const data = await res.json();
        if (res.ok && data.path) {
          if (isDump) {
            setDumpPath(data.path);
            scanDumpFile(data.path);
          } else {
            setMetadataPath(data.path);
          }
        }
      }
    } catch (err) {
      console.error('File browsing failed:', err);
    }
  };

  // Browse Output Folder (Selects folder, then automatically appends global-metadata-fixed.dat)
  const handleBrowseOutputFolder = async () => {
    try {
      if (window.electronAPI) {
        const result = await window.electronAPI.browseFolder({
          title: 'Chọn Thư Mục Lưu File Metadata Đã Sửa (Tự động thêm \\global-metadata-fixed.dat)'
        });
        if (result.selectedPath) {
          const sep = result.selectedPath.includes('/') ? '/' : '\\';
          const cleanDir = result.selectedPath.replace(/[/\\]+$/, '');
          setOutputPath(`${cleanDir}${sep}global-metadata-fixed.dat`);
        }
      } else {
        const initialDir = outputPath ? outputPath.replace(/[/\\][^/\\]+$/, '') : '';
        const res = await fetch(apiUrl('/api/browse-folder'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'Chọn Thư Mục Lưu File Metadata Đã Sửa',
            initialDir
          })
        });
        const data = await res.json();
        if (data.selectedPath) {
          const sep = data.selectedPath.includes('/') ? '/' : '\\';
          const cleanDir = data.selectedPath.replace(/[/\\]+$/, '');
          setOutputPath(`${cleanDir}${sep}global-metadata-fixed.dat`);
        }
      }
    } catch (err) {
      console.error('Folder browsing failed:', err);
    }
  };

  // Scan memory dump file for candidate headers
  const scanDumpFile = async (filePath?: string) => {
    const targetFile = filePath || dumpPath;
    if (!targetFile) return;

    setIsScanning(true);
    setErrorMsg(null);
    setFixResult(null);

    try {
      const res = await fetch(apiUrl('/api/fix-metadata/scan'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dumpPath: targetFile })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to scan memory dump file');
      }

      setCandidates(data.candidates || []);
      setSelectedCandidateIndex(0);
      if (data.candidates && data.candidates.length === 0) {
        setErrorMsg('Không tìm thấy Il2Cpp Metadata Header nào trong file dump.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setCandidates([]);
    } finally {
      setIsScanning(false);
    }
  };

  // Execute Header Replacement / Fix
  const handleApplyFix = async () => {
    if (!dumpPath) {
      setErrorMsg('Vui lòng chọn file memory dump (*.bin hoặc *.dat)');
      return;
    }
    if (!metadataPath) {
      setErrorMsg('Vui lòng chọn file global-metadata.dat cần sửa');
      return;
    }
    if (!outputPath) {
      setErrorMsg('Vui lòng chỉ định đường dẫn lưu file output');
      return;
    }

    const selectedCandidate = candidates[selectedCandidateIndex];
    if (!selectedCandidate) {
      setErrorMsg('Không có header candidate nào được chọn. Hãy quét lại file dump.');
      return;
    }

    setIsApplying(true);
    setErrorMsg(null);
    setFixResult(null);

    try {
      const res = await fetch(apiUrl('/api/fix-metadata/apply'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dumpPath,
          metadataPath,
          headerOffset: selectedCandidate.offset,
          headerSize: selectedCandidate.headerSize,
          patchEaToFa,
          outputPath,
          setAsActive
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Quá trình sửa header thất bại.');
      }

      setFixResult(data);
      onRefreshArtifacts();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsApplying(false);
    }
  };

  const handleOpenFolder = async (dirOrFile: string) => {
    try {
      await fetch(apiUrl('/api/open-folder'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dir: dirOrFile })
      });
    } catch (err) {
      console.error('Could not open folder:', err);
    }
  };

  const activeCandidate = candidates[selectedCandidateIndex];

  return (
    <div className="space-y-4">
      {/* Top Banner & Description */}
      <section className="panel-frame">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="w-3.5 h-3.5 text-accent" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              Il2Cpp Metadata Header Repair & De-obfuscator
            </h2>
          </div>
          <span className="text-[11px] font-mono text-accent font-medium">
            Tự động tìm Header trong *.bin/*.dat & thay thế vào global-metadata.dat
          </span>
        </div>

        <div className="p-3.5 bg-app-workspace space-y-3">
          <div className="p-3 rounded bg-app-subtle border border-app-border flex items-start gap-3">
            <Sparkles className="w-4 h-4 text-accent shrink-0 mt-0.5" />
            <div className="text-xs text-ink-secondary space-y-1">
              <p className="font-semibold text-ink-primary">
                Cơ chế phục hồi Header cho Game Unity / Tencent / Garena:
              </p>
              <p>
                File <code className="text-accent font-mono">global-metadata.dat</code> trên đĩa thường bị Tencent xóa hoặc mã hóa header (chứa magic bị đổi thành <code className="text-amber-400 font-mono">0xEAB11BAF</code> hoặc rác byte).
                Công cụ này sẽ tự động tìm kiếm cấu trúc <code className="text-emerald-400 font-mono">Il2CppGlobalMetadataHeader</code> nguyên vẹn trong bản dump bộ nhớ (<code className="font-mono">*.bin</code> hoặc <code className="font-mono">*.dat</code>), tự động vá <code className="text-accent font-bold">EA → FA (0xFAB11BAF)</code> cho Version 29 và ghi đè trực tiếp header chuẩn vào file metadata của bạn!
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Input Selection Grid */}
      <section className="panel-frame">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              Cấu hình đường dẫn File đầu vào & đầu ra
            </h3>
          </div>
          <button
            onClick={loadDefaults}
            className="btn-secondary-action px-2 py-0.5 text-xs flex items-center gap-1 cursor-pointer font-medium"
          >
            <RotateCw className="w-3 h-3 text-ink-secondary" />
            <span>Tải đường dẫn mặc định</span>
          </button>
        </div>

        <div className="p-3.5 space-y-3.5 bg-app-workspace">
          {/* Input 1: Memory Dump (*.bin or *.dat) */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                <Binary className="w-3.5 h-3.5 text-accent" />
                <span>1. File Memory Dump (*.bin hoặc *.dat):</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => scanDumpFile()}
                  disabled={!dumpPath || isScanning}
                  className="text-xs text-accent hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Search className="w-3 h-3" />
                  <span>{isScanning ? 'Đang quét...' : 'Quét lại Header'}</span>
                </button>
                <button
                  onClick={() => copyPath(dumpPath, 'dump')}
                  className="text-ink-muted hover:text-accent p-0.5 cursor-pointer"
                  title="Sao chép đường dẫn"
                >
                  {copiedTarget === 'dump' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={dumpPath}
                onChange={(e) => {
                  setDumpPath(e.target.value);
                  if (e.target.value.length > 5) scanDumpFile(e.target.value);
                }}
                placeholder="Chọn hoặc kéo thả file memory dump (*.bin, *.dat)..."
                className="control-input flex-1 px-3 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => handleBrowseFile('dump')}
                className="btn-secondary-action px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer font-medium whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5 text-accent" />
                <span>Chọn File...</span>
              </button>
            </div>
            <div className="text-[11px] text-ink-muted">
              Ví dụ file dump Frida/Memory: <code className="text-ink-secondary">com.garena.game.kgvn-7a6509e00000-7a650a200000.bin</code>
            </div>
          </div>

          {/* Input 2: Corrupted Target global-metadata.dat */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-400" />
                <span>2. File global-metadata.dat gốc cần sửa:</span>
              </label>
              <button
                onClick={() => copyPath(metadataPath, 'meta')}
                className="text-ink-muted hover:text-accent p-0.5 cursor-pointer"
                title="Sao chép đường dẫn"
              >
                {copiedTarget === 'meta' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={metadataPath}
                onChange={(e) => setMetadataPath(e.target.value)}
                placeholder="Chọn file global-metadata.dat trên đĩa..."
                className="control-input flex-1 px-3 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                onClick={() => handleBrowseFile('meta')}
                className="btn-secondary-action px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer font-medium whitespace-nowrap"
              >
                <FolderOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Chọn File...</span>
              </button>
            </div>
            <div className="text-[11px] text-ink-muted">
              Mặc định trong thư mục: <code className="text-amber-400 font-mono">workspace\Managed\global-metadata.dat</code>
            </div>
          </div>

          {/* Output: Destination fixed metadata */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-ink-primary flex items-center gap-1.5">
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>3. Đường dẫn lưu file metadata đã sửa (Fixed Output):</span>
              </label>
              <button
                onClick={() => copyPath(outputPath, 'out')}
                className="text-ink-muted hover:text-accent p-0.5 cursor-pointer"
                title="Sao chép đường dẫn"
              >
                {copiedTarget === 'out' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={outputPath}
                onChange={(e) => setOutputPath(e.target.value)}
                placeholder="Đường dẫn file metadata hoàn chỉnh sau khi fix..."
                className="control-input flex-1 px-3 py-1.5 text-xs font-mono"
              />
              <button
                type="button"
                onClick={handleBrowseOutputFolder}
                className="btn-secondary-action px-3 py-1.5 text-xs flex items-center gap-1.5 cursor-pointer font-medium whitespace-nowrap"
                title="Chọn thư mục lưu file (tự động gắn \global-metadata-fixed.dat)"
              >
                <Folder className="w-3.5 h-3.5 text-emerald-400" />
                <span>Chọn Thư Mục...</span>
              </button>
            </div>
            <div className="text-[11px] text-ink-muted">
              Chọn thư mục lưu (mặc định trong <code className="text-emerald-400 font-mono">workspace\</code>), công cụ sẽ tự động thêm <code className="text-emerald-400 font-mono">\global-metadata-fixed.dat</code> vào phía sau.
            </div>
          </div>

          {/* Options Checkboxes */}
          <div className="pt-2 border-t border-app-border space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={patchEaToFa}
                onChange={(e) => setPatchEaToFa(e.target.checked)}
                className="rounded border-app-border text-accent focus:ring-accent cursor-pointer"
              />
              <span className="text-xs font-medium text-ink-primary">
                Tự động sửa magic Tencent <code className="px-1 py-0.2 rounded bg-app-elevated text-accent font-bold">EA → FA</code> (0xEAB11BAF → 0xFAB11BAF) khi phát hiện Version 29 (Mặc định tích sẵn ⭐)
              </span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={setAsActive}
                onChange={(e) => setSetAsActive(e.target.checked)}
                className="rounded border-app-border text-accent focus:ring-accent cursor-pointer"
              />
              <span className="text-xs font-medium text-ink-primary">
                Tự động đặt file sau khi fix làm <code className="text-emerald-400 font-mono">workspace/global-metadata.dat</code> để bấm sang tab Pipeline là Dump được ngay
              </span>
            </label>
          </div>
        </div>
      </section>

      {/* Candidates Selection & Inspection */}
      <section className="panel-frame">
        <div className="panel-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-accent" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
              Header Candidates Tìm thấy trong File Dump ({candidates.length})
            </h3>
          </div>
          {isScanning ? (
            <span className="text-[11px] font-mono text-accent animate-pulse">
              Đang quét toàn bộ file memory dump...
            </span>
          ) : (
            <span className="text-[11px] font-mono text-ink-muted">
              {candidates.length > 0 ? `Đã tìm thấy ${candidates.length} header hợp lệ` : 'Chưa có header nào'}
            </span>
          )}
        </div>

        <div className="p-3.5 space-y-3 bg-app-workspace">
          {candidates.length === 0 ? (
            <div className="text-center py-6 text-ink-muted text-xs font-mono">
              {isScanning ? 'Đang tìm kiếm magic 0xEAB11BAF và 0xFAB11BAF...' : 'Hãy chọn file .bin hoặc .dat để quét header tự động.'}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Candidate Selection Radio / Card List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {candidates.map((c, idx) => (
                  <div
                    key={c.offsetHex}
                    onClick={() => setSelectedCandidateIndex(idx)}
                    className={`p-3 rounded border cursor-pointer transition-colors ${
                      selectedCandidateIndex === idx
                        ? 'bg-accent/10 border-accent text-ink-primary'
                        : 'bg-app-panel border-app-border hover:border-app-border-hover text-ink-secondary'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="candidate"
                          checked={selectedCandidateIndex === idx}
                          onChange={() => setSelectedCandidateIndex(idx)}
                          className="cursor-pointer text-accent focus:ring-accent"
                        />
                        <span className="text-xs font-bold font-mono text-ink-primary">
                          Offset: {c.offsetHex}
                        </span>
                        <span className="text-[10px] font-mono text-ink-muted">({c.offset.toLocaleString()} bytes)</span>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        Version {c.version}
                      </span>
                    </div>

                    <div className="mt-2 text-xs font-mono space-y-1">
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Magic Bytes:</span>
                        <span className="text-ink-primary font-bold">{c.magicHex.toUpperCase()} ({c.magicName})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">Header Size:</span>
                        <span className="text-ink-primary">{c.headerSize} bytes (0x{c.headerSize.toString(16)})</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">stringLiteralDataOffset:</span>
                        <span className="text-accent">{c.stringLiteralDataOffset}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-ink-muted">stringOffset:</span>
                        <span className="text-ink-primary">{c.stringOffset}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Active Candidate Detailed Breakdown */}
              {activeCandidate && (
                <div className="p-3 rounded bg-app-elevated border border-app-border space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-accent flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Header đã chọn sẵn sàng để thay thế (Offset: {activeCandidate.offsetHex}):
                    </span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      Sau khi fix magic sẽ là: <strong className="text-emerald-400 font-bold">AF 1B B1 FA (0xFAB11BAF)</strong>
                    </span>
                  </div>
                  <div className="p-2 rounded bg-black/40 border border-app-border font-mono text-[11px] text-ink-secondary break-all">
                    {activeCandidate.previewHex}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <button
              onClick={handleApplyFix}
              disabled={isApplying || candidates.length === 0}
              className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 rounded transition-colors cursor-pointer ${
                isApplying || candidates.length === 0
                  ? 'bg-app-elevated text-ink-muted cursor-not-allowed border border-app-border'
                  : 'btn-primary-action'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{isApplying ? 'Đang sửa và thay thế Header...' : '⚡ FIX & REPLACE METADATA HEADER'}</span>
            </button>

            {candidates.length > 0 && (
              <span className="text-xs text-ink-muted font-mono">
                Sẽ ghi đè chính xác {activeCandidate?.headerSize || 256} bytes đầu vào {metadataPath ? metadataPath.split(/[\\/]/).pop() : 'global-metadata.dat'}
              </span>
            )}
          </div>

          {errorMsg && (
            <div className="p-3 rounded bg-status-error/10 border border-status-error/30 text-xs text-status-error flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </section>

      {/* Success Result View */}
      {fixResult && (
        <section className="panel-frame border-emerald-500/40 bg-emerald-950/10">
          <div className="panel-header bg-emerald-950/20 border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <h3 className="text-xs font-semibold uppercase tracking-wider">
                Đã sửa & xuất File Metadata thành công!
              </h3>
            </div>
            <span className="text-[11px] font-mono text-emerald-400 font-bold">
              Metadata v{fixResult.version} • {formatBytes(fixResult.fileSize)}
            </span>
          </div>

          <div className="p-3.5 space-y-3">
            <div className="p-3 rounded bg-app-workspace border border-emerald-500/20 space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-medium text-ink-secondary">Đường dẫn file đã sửa:</span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyPath(fixResult.outputPath, 'fixedResult')}
                    className="btn-secondary-action px-2 py-1 text-xs flex items-center gap-1 cursor-pointer font-medium"
                  >
                    {copiedTarget === 'fixedResult' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedTarget === 'fixedResult' ? 'Đã sao chép!' : 'Sao chép đường dẫn'}</span>
                  </button>
                  <button
                    onClick={() => handleOpenFolder(fixResult.outputPath)}
                    className="btn-secondary-action px-2 py-1 text-xs flex items-center gap-1 cursor-pointer font-medium"
                  >
                    <FolderOpen className="w-3 h-3 text-accent" />
                    <span>Mở thư mục</span>
                  </button>
                </div>
              </div>
              <div className="p-2 rounded bg-black/40 font-mono text-xs text-emerald-400 break-all border border-app-border">
                {fixResult.outputPath}
              </div>
            </div>

            {/* Header Hex Comparison */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
              <div className="p-2.5 rounded bg-app-panel border border-app-border space-y-1">
                <div className="flex items-center justify-between text-ink-muted text-[11px]">
                  <span>Header cũ trước khi fix:</span>
                  <span className="text-amber-400">Magic: {fixResult.origHeaderPreview.slice(0, 8).toUpperCase()}</span>
                </div>
                <div className="p-1.5 rounded bg-black/30 text-ink-secondary text-[11px] break-all">
                  {fixResult.origHeaderPreview}
                </div>
              </div>

              <div className="p-2.5 rounded bg-app-panel border border-emerald-500/30 space-y-1">
                <div className="flex items-center justify-between text-ink-muted text-[11px]">
                  <span>Header mới chuẩn sau khi sửa:</span>
                  <span className="text-emerald-400 font-bold">Magic: {fixResult.newHeaderPreview.slice(0, 8).toUpperCase()} (0xFAB11BAF)</span>
                </div>
                <div className="p-1.5 rounded bg-black/30 text-emerald-300 text-[11px] break-all">
                  {fixResult.newHeaderPreview}
                </div>
              </div>
            </div>

            {/* Switch to Pipeline CTA */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-xs text-ink-secondary flex items-center gap-1.5">
                <FolderCheck className="w-4 h-4 text-emerald-400" />
                <span>
                  {setAsActive
                    ? 'File này đã được tự động áp dụng vào Workspace. Bạn có thể tiến hành Decompile ngay!'
                    : 'File đã sẵn sàng để nạp vào Il2CppDumper.'}
                </span>
              </div>

              <button
                onClick={() => onSwitchToPipeline(fixResult.outputPath)}
                className="btn-primary-action px-4 py-2 text-xs flex items-center gap-1.5 cursor-pointer font-semibold"
              >
                <span>Chuyển sang Tab Pipeline để Decompile ngay</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
