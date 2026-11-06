import React, { useState, useEffect, useRef } from 'react';
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

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

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

  // Synchronize scroll positions between textarea, syntax highlight pre, and line numbers
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget;
    if (highlightRef.current) {
      highlightRef.current.scrollTop = scrollTop;
      highlightRef.current.scrollLeft = scrollLeft;
    }
    if (lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  // Keyboard ergonomics: Tab indents with 4 spaces instead of losing focus
  const handleTextareaKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;

      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      setEditedCode(newValue);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    }
  };

  // Syntax highlighting line formatter
  const renderHighlightedLine = (line: string, lineIndex: number) => {
    if (!line) {
      return <span>&nbsp;</span>;
    }

    // 1. Full Line Comment
    if (line.trim().startsWith('//')) {
      return (
        <span key={lineIndex} className="text-[#676E6A] italic">
          {line}
        </span>
      );
    }

    // Split line by string literals, block comments, and inline comments
    const stringParts = line.split(/("(?:[^"\\]|\\.)*"|\/\*.*?\*\/|\/\/.*$)/g);

    return (
      <span key={lineIndex}>
        {stringParts.map((part, pIdx) => {
          if (!part) return null;

          // Inline or trailing comment
          if (part.startsWith('//')) {
            return (
              <span key={pIdx} className="text-[#676E6A] italic select-text">
                {part}
              </span>
            );
          }

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
              <span key={pIdx} className="text-[#6E9B7B]/90 italic font-semibold select-text">
                {part}
              </span>
            );
          }

          // Tokens in code
          const tokens = part.split(/(\b(?:public|private|protected|internal|virtual|override|abstract|static|sealed|class|struct|interface|enum|void|int|float|bool|string|long|uint|ulong|byte|sbyte|short|ushort|char|double|decimal|object|const|readonly|return|if|else|while|for|foreach|switch|case|break|continue|new|this|null|true|false|sizeof|typeof|nullptr|async|await|using|namespace|get|set|value|var|params|ref|out|in|is|as|try|catch|finally|throw|goto|default|__int64|__int32|__int16|__int8|_QWORD|_DWORD|_WORD|_BYTE|BYREF|MethodInfo|Il2CppObject|Il2CppString|Il2CppClass|Il2CppArray|uintptr_t|intptr_t|size_t)\b|0x[0-9A-Fa-f]+|\b\d+(?:\.\d+)?f?\b|\b[A-Za-z0-9_]+_o\b|\b[A-Za-z0-9_]+(?=\()|->|=>|\+\+|--|==|!=|<=|>=|&&|\|\||[{}();,])/g);

          return (
            <span key={pIdx}>
              {tokens.map((tok, tIdx) => {
                if (!tok) return null;

                // Keywords
                if (/^(public|private|protected|internal|virtual|override|abstract|static|sealed|class|struct|interface|enum|void|const|readonly|return|if|else|while|for|foreach|switch|case|break|continue|new|this|null|true|false|nullptr|async|await|using|namespace|get|set|value|var|params|ref|out|in|is|as|try|catch|finally|throw|goto|default)$/.test(tok)) {
                  return (
                    <span key={tIdx} className="text-sky-400 font-semibold">
                      {tok}
                    </span>
                  );
                }

                // Types & Structs
                if (/^(int|float|bool|string|long|uint|ulong|byte|sbyte|short|ushort|char|double|decimal|object|__int64|__int32|__int16|__int8|_QWORD|_DWORD|_WORD|_BYTE|BYREF|MethodInfo|Il2CppObject|Il2CppString|Il2CppClass|Il2CppArray|uintptr_t|intptr_t|size_t)$/.test(tok) || tok.endsWith('_o')) {
                  return (
                    <span key={tIdx} className="text-emerald-400 font-medium">
                      {tok}
                    </span>
                  );
                }

                // Hex & Decimal Numbers
                if (/^(0x[0-9A-Fa-f]+|\d+(?:\.\d+)?f?)$/.test(tok)) {
                  return (
                    <span key={tIdx} className="text-fuchsia-400 font-mono">
                      {tok}
                    </span>
                  );
                }

                // Pointers & Arrows
                if (tok === '->' || tok === '=>') {
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
                      onClick={() => !isEditing && onSymbolClick && onSymbolClick(tok)}
                      className={`text-amber-200 ${!isEditing && onSymbolClick ? 'cursor-pointer hover:underline hover:text-accent' : ''}`}
                      title={!isEditing && onSymbolClick ? `Jump to ${tok}` : undefined}
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
    <div className="flex flex-col h-full rounded border border-[#2C3236] bg-[#0d1117] overflow-hidden text-xs font-mono">
      {/* Control Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#161b22] border-b border-[#2C3236] select-none shrink-0">
        <div className="flex items-center gap-2">
          {/* File Name Tag */}
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#E6E8E6] bg-[#121416] px-2 py-0.5 rounded border border-[#2C3236]">
            <FileCode2 className="w-3.5 h-3.5 text-[#C49B66]" />
            <span>{fileName}</span>
          </span>

          {/* Mode Switcher: Clean C# vs Raw C */}
          {cleanCode && (
            <div className="flex items-center rounded border border-[#2C3236] bg-[#0d1117] p-0.5">
              <button
                type="button"
                onClick={() => setViewMode('clean')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-default ${
                  viewMode === 'clean' ? 'bg-[#C49B66] text-[#121416] font-semibold shadow-sm' : 'text-[#9FA6A2] hover:text-[#E6E8E6]'
                }`}
                title="Clean reconstructed C# pseudocode (unwrapped structs, dereferenced pointers, string literals)"
              >
                <Sparkles className="w-3 h-3" />
                <span>Clean C# Pseudo</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 cursor-default ${
                  viewMode === 'raw' ? 'bg-[#1F2326] text-[#E6E8E6]' : 'text-[#9FA6A2] hover:text-[#E6E8E6]'
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
            type="button"
            onClick={() => setIsEditing(!isEditing)}
            className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1.5 cursor-default ${
              isEditing
                ? 'border-amber-500/50 bg-amber-500/15 text-amber-300 font-semibold shadow-sm'
                : 'border-[#2C3236] bg-[#0d1117] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#4B5563]'
            }`}
            title="Toggle in-memory scratchpad editor mode (with live syntax coloring)"
          >
            <Edit3 className="w-3.5 h-3.5" />
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
              type="button"
              onClick={handleReset}
              className="px-2 py-1 rounded bg-[#0d1117] border border-[#2C3236] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#4B5563] cursor-default flex items-center gap-1 text-[11px]"
              title="Revert scratchpad to original decompiled source code"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Original</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopy}
            className={`px-2.5 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1 cursor-default ${
              copied
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                : 'border-[#2C3236] bg-[#0d1117] text-[#9FA6A2] hover:text-[#C49B66] hover:border-[#C49B66]'
            }`}
            title="Copy code to clipboard"
          >
            {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>

          {onDownloadCs && (
            <button
              type="button"
              onClick={onDownloadCs}
              className="px-2.5 py-1 rounded bg-[#C49B66]/15 border border-[#C49B66]/40 text-[#C49B66] hover:bg-[#C49B66]/25 cursor-default flex items-center gap-1 text-[11px] font-medium"
              title="Export this class as a standalone .cs file"
            >
              <Download className="w-3 h-3" />
              <span>Export .cs</span>
            </button>
          )}
        </div>
      </div>

      {/* In-Memory Scratchpad Notice Banner */}
      {isEditing && (
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-[11px] flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>
              <strong>In-Memory Scratchpad Active (Syntax Color Enabled):</strong> Edit code freely for temporary tweaking &amp; copying. Changes <u>are never written to disk</u>.
            </span>
          </div>
          <span className="text-[10px] text-amber-400/80 font-mono">
            Press [Tab] for 4 spaces • Click &quot;Reset Original&quot; to restore
          </span>
        </div>
      )}

      {/* Code Display & Scratchpad Editor Area */}
      <div className="flex-1 overflow-hidden relative flex bg-[#0d1117]">
        {isEditing ? (
          /* SYNTAX-HIGHLIGHTED EDITABLE SCRATCHPAD */
          <div className="flex-1 flex overflow-hidden relative">
            {/* Synchronized Line Numbers Gutter */}
            <div
              ref={lineNumbersRef}
              className="w-12 shrink-0 overflow-hidden bg-[#0d1117] border-r border-[#21262d] select-none text-right pr-3 py-3 text-[11px] font-mono text-[#676E6A]/70"
            >
              {lines.map((_, idx) => (
                <div key={idx} className="h-[20px] leading-[20px]">
                  {idx + 1}
                </div>
              ))}
            </div>

            {/* Editor Workspace Container */}
            <div className="flex-1 relative overflow-hidden">
              {/* Layer 1 (Underneath): Live Syntax Highlighting Render */}
              <pre
                ref={highlightRef}
                aria-hidden="true"
                style={{ tabSize: 4 }}
                className="absolute inset-0 m-0 p-3 overflow-hidden font-mono text-xs leading-[20px] whitespace-pre pointer-events-none select-none"
              >
                {lines.map((line, idx) => (
                  <div key={idx} className="h-[20px] leading-[20px] whitespace-pre">
                    {line ? renderHighlightedLine(line, idx) : <span>&nbsp;</span>}
                  </div>
                ))}
              </pre>

              {/* Layer 2 (On Top): Transparent Interactive Textarea */}
              <textarea
                ref={textareaRef}
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleTextareaKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                style={{ tabSize: 4 }}
                className="absolute inset-0 w-full h-full m-0 p-3 bg-transparent font-mono text-xs leading-[20px] whitespace-pre text-transparent caret-[#E6E8E6] selection:bg-[#C49B66]/35 selection:text-transparent resize-none outline-none border-0 overflow-auto z-10 select-text"
              />
            </div>
          </div>
        ) : (
          /* READ-ONLY SYNTAX-HIGHLIGHTED VIEW */
          <div className="flex-1 overflow-auto p-3.5 select-text min-w-full">
            {lines.map((line, idx) => (
              <div key={idx} className="flex hover:bg-[#161b22]/60 rounded px-1 -mx-1 group leading-[20px]">
                <span className="w-10 shrink-0 text-right pr-3 text-[#676E6A]/60 select-none text-[11px] group-hover:text-[#9FA6A2] leading-[20px]">
                  {idx + 1}
                </span>
                <span className="flex-1 whitespace-pre select-text font-mono leading-[20px]">
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
