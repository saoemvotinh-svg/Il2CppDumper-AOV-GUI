import React, { useState, useEffect } from 'react';
import { Copy, Check, RotateCcw, Download, Edit3, Eye, Sparkles, FileCode2 } from 'lucide-react';

interface CodeViewerProps {
  code: string;
  cleanCode?: string;
  fileName?: string;
  isDecompiled?: boolean;
  onSymbolClick?: (symbolName: string) => void;
  onDownloadCs?: () => void;
}

export const CodeViewer: React.FC<CodeViewerProps> = ({
  code,
  cleanCode,
  fileName = 'Code.cs',
  isDecompiled = false,
  onSymbolClick,
  onDownloadCs
}) => {
  const [viewMode, setViewMode] = useState<'clean' | 'raw'>('clean');
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState(code);
  const [copied, setCopied] = useState(false);

  // Sync editedCode when source code or viewMode changes
  useEffect(() => {
    const target = viewMode === 'clean' && cleanCode ? cleanCode : code;
    setEditedCode(target);
    setIsEditing(false);
  }, [code, cleanCode, viewMode]);

  const activeDisplayCode = isEditing ? editedCode : (viewMode === 'clean' && cleanCode ? cleanCode : code);

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDisplayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    const original = viewMode === 'clean' && cleanCode ? cleanCode : code;
    setEditedCode(original);
  };

  // Syntax highlighting line formatter
  const renderHighlightedLine = (line: string, lineIndex: number) => {
    // 1. Comments
    if (line.trim().startsWith('//')) {
      return (
        <span key={lineIndex} className="text-ink-muted/70 italic">
          {line}
        </span>
      );
    }

    // Split line by string literals first to protect string contents
    const stringParts = line.split(/("(?:[^"\\]|\\.)*"|\/\*.*?\*\/)/g);

    return (
      <span key={lineIndex}>
        {stringParts.map((part, pIdx) => {
          if (!part) return null;

          // String Literal
          if (part.startsWith('"') && part.endsWith('"')) {
            return (
              <span key={pIdx} className="text-amber-300 font-medium select-text">
                {part}
              </span>
            );
          }

          // Block Comment /* ... */
          if (part.startsWith('/*') && part.endsWith('*/')) {
            return (
              <span key={pIdx} className="text-status-ready/90 italic font-semibold select-text">
                {part}
              </span>
            );
          }

          // Tokens in code
          const tokens = part.split(/(\b(?:public|private|protected|internal|virtual|override|abstract|static|sealed|class|struct|interface|enum|void|int|float|bool|string|long|uint|ulong|byte|ushort|const|return|if|else|while|for|switch|case|break|continue|new|this|null|true|false|sizeof|typeof|nullptr|__int64|_QWORD|_DWORD|_WORD|_BYTE|BYREF|MethodInfo|Il2CppObject)\b|0x[0-9A-Fa-f]+|\b[A-Za-z0-9_]+_o\b|\b[A-Za-z0-9_]+(?=\()|->|[{}();,])/g);

          return (
            <span key={pIdx}>
              {tokens.map((tok, tIdx) => {
                if (!tok) return null;

                // Keywords
                if (/^(public|private|protected|internal|virtual|override|abstract|static|sealed|class|struct|interface|enum|void|const|return|if|else|while|for|switch|case|break|continue|new|this|null|true|false|nullptr)$/.test(tok)) {
                  return (
                    <span key={tIdx} className="text-sky-400 font-semibold">
                      {tok}
                    </span>
                  );
                }

                // Types
                if (/^(int|float|bool|string|long|uint|ulong|byte|ushort|__int64|_QWORD|_DWORD|_WORD|_BYTE|BYREF|MethodInfo|Il2CppObject)$/.test(tok) || tok.endsWith('_o')) {
                  return (
                    <span key={tIdx} className="text-emerald-400 font-medium">
                      {tok}
                    </span>
                  );
                }

                // Hex Numbers
                if (/^0x[0-9A-Fa-f]+$/.test(tok)) {
                  return (
                    <span key={tIdx} className="text-fuchsia-400 font-mono">
                      {tok}
                    </span>
                  );
                }

                // Pointers & Operators
                if (tok === '->') {
                  return (
                    <span key={tIdx} className="text-rose-400 font-bold">
                      {tok}
                    </span>
                  );
                }

                // Method Calls
                if (/^[A-Za-z0-9_]+$/.test(tok) && part[part.indexOf(tok) + tok.length] === '(') {
                  return (
                    <span
                      key={tIdx}
                      onClick={() => onSymbolClick && onSymbolClick(tok)}
                      className={`text-amber-200 ${onSymbolClick ? 'cursor-pointer hover:underline hover:text-accent' : ''}`}
                      title={onSymbolClick ? `Jump to ${tok}` : undefined}
                    >
                      {tok}
                    </span>
                  );
                }

                return <span key={tIdx}>{tok}</span>;
              })}
            </span>
          );
        })}
      </span>
    );
  };

  const lines = activeDisplayCode.split('\n');

  return (
    <div className="flex flex-col h-full rounded border border-app-border bg-[#0d1117] overflow-hidden text-xs font-mono">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#161b22] border-b border-app-border select-none">
        <div className="flex items-center gap-2">
          {/* File Name Tag */}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-primary bg-app-workspace px-2 py-0.5 rounded border border-app-border">
            <FileCode2 className="w-3.5 h-3.5 text-accent" />
            <span>{fileName}</span>
          </span>

          {/* Mode Switcher: Clean C# vs Raw C */}
          {cleanCode && (
            <div className="flex items-center rounded border border-app-border bg-[#0d1117] p-0.5">
              <button
                onClick={() => setViewMode('clean')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  viewMode === 'clean' ? 'bg-accent text-white shadow-sm' : 'text-ink-secondary hover:text-ink-primary'
                }`}
                title="Clean reconstructed C# pseudocode (unwrapped structs, dereferenced pointers, string literals)"
              >
                <Sparkles className="w-3 h-3" />
                <span>Clean C# Pseudo</span>
              </button>
              <button
                onClick={() => setViewMode('raw')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                  viewMode === 'raw' ? 'bg-app-elevated text-ink-primary' : 'text-ink-secondary hover:text-ink-primary'
                }`}
                title="Raw Hex-Rays C pseudocode (raw registers, pointer offsets, call sites)"
              >
                <Eye className="w-3 h-3" />
                <span>Raw Hex-Rays C</span>
              </button>
            </div>
          )}

          {/* Scratchpad Toggle */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              isEditing
                ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                : 'border-app-border bg-[#0d1117] text-ink-secondary hover:text-ink-primary hover:border-ink-muted'
            }`}
            title="Toggle scratchpad editor mode (in-memory edits for quick copying - never writes to disk)"
          >
            <Edit3 className="w-3 h-3" />
            <span>{isEditing ? 'Scratchpad Active' : 'Scratchpad Editor'}</span>
          </button>

          {isDecompiled && (
            <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
              ⚡ Hex-Rays
            </span>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {isEditing && (
            <button
              onClick={handleReset}
              className="px-2 py-1 rounded bg-[#0d1117] border border-app-border text-ink-secondary hover:text-ink-primary cursor-pointer flex items-center gap-1 text-[11px]"
              title="Revert scratchpad to original source code"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Original</span>
            </button>
          )}

          <button
            onClick={handleCopy}
            className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              copied
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-app-border bg-[#0d1117] text-ink-secondary hover:text-accent hover:border-accent'
            }`}
            title="Copy code to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>

          {onDownloadCs && (
            <button
              onClick={onDownloadCs}
              className="px-2.5 py-1 rounded bg-accent/15 border border-accent/40 text-accent hover:bg-accent/25 cursor-pointer flex items-center gap-1 text-[11px] font-medium"
              title="Export this class as a standalone .cs file"
            >
              <Download className="w-3 h-3" />
              <span>Export .cs</span>
            </button>
          )}
        </div>
      </div>

      {/* In-Memory Scratchpad Notice */}
      {isEditing && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between">
          <span>
            ⚠️ <strong>In-Memory Scratchpad:</strong> Edit code directly for temporary experimentation or copying. Edits <u>are never written to disk</u>.
          </span>
          <span className="text-[10px] text-amber-400/80">Click &quot;Reset Original&quot; to restore source code at any time</span>
        </div>
      )}

      {/* Code Content Area */}
      <div className="flex-1 overflow-auto relative">
        {isEditing ? (
          <textarea
            value={editedCode}
            onChange={(e) => setEditedCode(e.target.value)}
            spellCheck={false}
            className="w-full h-full min-h-[350px] p-3.5 bg-transparent text-ink-primary font-mono text-xs leading-relaxed resize-none outline-none focus:ring-0 border-0 select-text"
          />
        ) : (
          <div className="p-3.5 select-text min-w-full inline-block">
            {lines.map((line, idx) => (
              <div key={idx} className="flex hover:bg-[#161b22]/60 rounded px-1 -mx-1 group leading-relaxed">
                <span className="w-10 shrink-0 text-right pr-3 text-ink-muted/50 select-none text-[11px] group-hover:text-ink-muted">
                  {idx + 1}
                </span>
                <span className="flex-1 whitespace-pre select-text font-mono">
                  {renderHighlightedLine(line, idx)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
