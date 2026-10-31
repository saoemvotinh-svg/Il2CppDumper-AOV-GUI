import React, { useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Copy, Trash2, ArrowDown, Check, Loader2 } from 'lucide-react';
import type { LogEntry } from '../types';

interface TerminalViewProps {
  logs: LogEntry[];
  isRunning: boolean;
  onClear: () => void;
  autoScroll: boolean;
  setAutoScroll: (auto: boolean) => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
  logs,
  isRunning,
  onClear,
  autoScroll,
  setAutoScroll,
}) => {
  const terminalContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = React.useState(false);

  useEffect(() => {
    if (autoScroll && terminalContainerRef.current) {
      terminalContainerRef.current.scrollTop = terminalContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleCopyLogs = () => {
    const text = logs.map(l => `[${l.timestamp}] ${l.line}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getLineStyle = (level: LogEntry['level']) => {
    switch (level) {
      case 'error':
        return 'text-status-error';
      case 'warn':
        return 'text-status-warning';
      case 'success':
        return 'text-status-ready font-medium';
      case 'highlight':
        return 'text-accent font-medium';
      case 'start':
        return 'text-ink-primary font-semibold border-b border-app-border pb-1 mb-1';
      default:
        return 'text-ink-primary';
    }
  };

  return (
    <section className="panel-frame flex flex-col h-[400px]">
      {/* Console Header Bar */}
      <div className="panel-header flex items-center justify-between select-none">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
            Diagnostic Console Output
          </h2>
          <span className="text-[11px] font-mono text-ink-muted">
            ({logs.length} entries)
          </span>
          {isRunning && (
            <span className="flex items-center gap-1.5 text-[11px] text-accent font-mono ml-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Running
            </span>
          )}
        </div>

        {/* Toolbar Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2 py-1 rounded text-xs transition-colors cursor-pointer border ${
              autoScroll
                ? 'bg-app-elevated text-ink-primary border-app-border'
                : 'text-ink-muted border-transparent hover:text-ink-secondary'
            }`}
            title="Toggle Auto-Scroll"
          >
            <ArrowDown className="w-3 h-3" />
          </button>
          <button
            onClick={handleCopyLogs}
            className="btn-secondary-action px-2 py-1 text-xs cursor-pointer flex items-center gap-1"
            title="Copy entire console log"
          >
            {copied ? (
              <Check className="w-3 h-3 text-status-ready" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
            <span className="text-[11px]">Copy</span>
          </button>
          <button
            onClick={onClear}
            className="btn-secondary-action px-2 py-1 text-xs cursor-pointer text-ink-secondary hover:text-status-error"
            title="Clear console"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal Viewport */}
      <div
        ref={terminalContainerRef}
        className="flex-1 p-3.5 font-mono text-xs overflow-y-auto space-y-0.5 bg-app-bg select-text"
      >
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-ink-muted space-y-1">
            <span className="text-xs">No active process. Click &ldquo;Execute Decompilation&rdquo; to begin.</span>
          </div>
        ) : (
          logs.map((entry, idx) => (
            <div key={idx} className={`leading-5 break-all flex items-start gap-2 select-text ${getLineStyle(entry.level)}`}>
              <span className="text-ink-muted text-[11px] select-none shrink-0 font-mono">
                {entry.timestamp}
              </span>
              <span className="flex-1 select-text">{entry.line}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
