import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Copy,
  Check,
  RotateCcw,
  Download,
  Edit3,
  Eye,
  Sparkles,
  FileCode2,
  Search,
  Replace,
  ReplaceAll,
  ArrowUp,
  ArrowDown,
  X,
  ChevronDown,
  ChevronRight,
  Hash,
  WrapText,
  ZoomIn,
  ZoomOut
} from 'lucide-react';

interface CodeViewerProps {
  code: string;
  cleanCode?: string;
  fileName?: string;
  isDecompiled?: boolean;
  onSymbolClick?: (symbolName: string) => void;
  onDownloadCs?: () => void;
}

interface SearchMatch {
  id: number;
  charStart: number;
  charEnd: number;
  lineIndex: number;
  colStart: number;
  colEnd: number;
  text: string;
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

  // Editor telemetry and ergonomics states
  const [fontSize, setFontSize] = useState(12);
  const [isWordWrap, setIsWordWrap] = useState(false);
  const [cursorInfo, setCursorInfo] = useState({ line: 1, col: 1 });
  const [flashedLine, setFlashedLine] = useState<number | null>(null);

  // Find & Replace Suite States
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [isGoToLineOpen, setIsGoToLineOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [matchWholeWord, setMatchWholeWord] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const [replaceNotice, setReplaceNotice] = useState<string | null>(null);
  const [goToLineNumber, setGoToLineNumber] = useState('');

  // DOM References
  const containerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const readOnlyContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const goToLineInputRef = useRef<HTMLInputElement>(null);

  // Sync editedCode when source code or viewMode changes
  useEffect(() => {
    const target = viewMode === 'clean' && cleanCode ? cleanCode : code;
    setEditedCode(target);
    setIsEditing(false);
  }, [code, cleanCode, viewMode]);

  const activeDisplayCode = isEditing ? editedCode : (viewMode === 'clean' && cleanCode ? cleanCode : code);
  const lines = useMemo(() => activeDisplayCode.split('\n'), [activeDisplayCode]);
  const lineHeight = Math.round(fontSize * 1.66);

  // --- Search Matching Engine ---
  const { matches, regexError } = useMemo(() => {
    if (!searchQuery) {
      return { matches: [] as SearchMatch[], regexError: null as string | null };
    }

    let pattern: RegExp;
    try {
      let source = searchQuery;
      if (!useRegex) {
        source = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (matchWholeWord) {
        source = `\\b${source}\\b`;
      }
      pattern = new RegExp(source, matchCase ? 'g' : 'gi');
    } catch (err: any) {
      return { matches: [] as SearchMatch[], regexError: err.message || 'Invalid Regular Expression' };
    }

    const results: SearchMatch[] = [];
    const textLines = lines;
    const lineStartOffsets: number[] = [];
    let curOffset = 0;
    for (let i = 0; i < textLines.length; i++) {
      lineStartOffsets.push(curOffset);
      curOffset += textLines[i].length + 1; // +1 for \n
    }

    let m: RegExpExecArray | null;
    let count = 0;
    const MAX_MATCHES = 3000;

    while ((m = pattern.exec(activeDisplayCode)) !== null && count < MAX_MATCHES) {
      const charStart = m.index;
      const matchedText = m[0];
      const charEnd = charStart + matchedText.length;

      if (matchedText.length === 0) {
        pattern.lastIndex++;
        continue;
      }

      // Binary search line index
      let low = 0;
      let high = lineStartOffsets.length - 1;
      let lineIdx = 0;
      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        if (lineStartOffsets[mid] <= charStart) {
          lineIdx = mid;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      const colStart = charStart - lineStartOffsets[lineIdx];
      const colEnd = colStart + matchedText.length;

      results.push({
        id: count++,
        charStart,
        charEnd,
        lineIndex: lineIdx,
        colStart,
        colEnd,
        text: matchedText
      });
    }

    return { matches: results, regexError: null };
  }, [activeDisplayCode, searchQuery, matchCase, matchWholeWord, useRegex, lines]);

  // Keep currentMatchIndex in bounds
  useEffect(() => {
    if (matches.length === 0) {
      setCurrentMatchIndex(0);
    } else if (currentMatchIndex >= matches.length) {
      setCurrentMatchIndex(matches.length - 1);
    }
  }, [matches.length, currentMatchIndex]);

  // Map of lineIndex -> SearchMatch[] for O(1) line match lookup
  const lineMatchesMap = useMemo(() => {
    const map = new Map<number, SearchMatch[]>();
    for (const m of matches) {
      const existing = map.get(m.lineIndex);
      if (existing) {
        existing.push(m);
      } else {
        map.set(m.lineIndex, [m]);
      }
    }
    return map;
  }, [matches]);

  // Current active match
  const activeMatch = matches[currentMatchIndex] || null;

  // Scroll to active match
  const scrollToMatch = useCallback((match: SearchMatch | null) => {
    if (!match) return;
    const targetY = Math.max(0, match.lineIndex * lineHeight - 120);

    if (isEditing) {
      if (textareaRef.current) {
        textareaRef.current.scrollTop = targetY;
        textareaRef.current.setSelectionRange(match.charStart, match.charEnd);
      }
      if (highlightRef.current) {
        highlightRef.current.scrollTop = targetY;
      }
      if (lineNumbersRef.current) {
        lineNumbersRef.current.scrollTop = targetY;
      }
    } else {
      if (readOnlyContainerRef.current) {
        readOnlyContainerRef.current.scrollTop = targetY;
      }
    }
  }, [isEditing, lineHeight]);

  // Navigation handlers
  const handleNextMatch = useCallback(() => {
    if (matches.length === 0) return;
    const nextIdx = (currentMatchIndex + 1) % matches.length;
    setCurrentMatchIndex(nextIdx);
    scrollToMatch(matches[nextIdx]);
  }, [matches, currentMatchIndex, scrollToMatch]);

  const handlePrevMatch = useCallback(() => {
    if (matches.length === 0) return;
    const prevIdx = (currentMatchIndex - 1 + matches.length) % matches.length;
    setCurrentMatchIndex(prevIdx);
    scrollToMatch(matches[prevIdx]);
  }, [matches, currentMatchIndex, scrollToMatch]);

  // Replace handlers
  const handleReplaceOne = useCallback(() => {
    if (matches.length === 0 || !activeMatch) return;
    if (!isEditing) setIsEditing(true);

    const m = activeMatch;
    const source = isEditing ? editedCode : activeDisplayCode;
    const newCode = source.substring(0, m.charStart) + replaceQuery + source.substring(m.charEnd);
    setEditedCode(newCode);

    setReplaceNotice('Replaced 1 match');
    setTimeout(() => setReplaceNotice(null), 2500);
  }, [matches.length, activeMatch, isEditing, editedCode, activeDisplayCode, replaceQuery]);

  const handleReplaceAll = useCallback(() => {
    if (matches.length === 0) return;
    if (!isEditing) setIsEditing(true);

    let pattern: RegExp;
    try {
      let source = searchQuery;
      if (!useRegex) {
        source = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      }
      if (matchWholeWord) {
        source = `\\b${source}\\b`;
      }
      pattern = new RegExp(source, matchCase ? 'g' : 'gi');
    } catch {
      return;
    }

    const count = matches.length;
    const source = isEditing ? editedCode : activeDisplayCode;
    const newCode = source.replace(pattern, replaceQuery);
    setEditedCode(newCode);

    setReplaceNotice(`Replaced ${count} occurrences`);
    setTimeout(() => setReplaceNotice(null), 3000);
  }, [matches.length, isEditing, searchQuery, useRegex, matchWholeWord, matchCase, editedCode, activeDisplayCode, replaceQuery]);

  // Go to Line handler
  const handleGoToLine = useCallback(() => {
    const targetLineNum = parseInt(goToLineNumber.trim(), 10);
    if (isNaN(targetLineNum) || targetLineNum < 1 || targetLineNum > lines.length) {
      return;
    }

    const targetIdx = targetLineNum - 1;
    const targetY = Math.max(0, targetIdx * lineHeight - 100);

    if (isEditing) {
      if (textareaRef.current) textareaRef.current.scrollTop = targetY;
      if (highlightRef.current) highlightRef.current.scrollTop = targetY;
      if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = targetY;
    } else {
      if (readOnlyContainerRef.current) readOnlyContainerRef.current.scrollTop = targetY;
    }

    setFlashedLine(targetIdx);
    setTimeout(() => setFlashedLine(null), 1500);
    setIsGoToLineOpen(false);
  }, [goToLineNumber, lines.length, lineHeight, isEditing]);

  // Open Find Bar with optional auto-filled selected text
  const openFind = useCallback((withReplace = false) => {
    let selected = '';
    if (isEditing && textareaRef.current) {
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      if (start !== end) {
        selected = textareaRef.current.value.substring(start, end);
      }
    } else {
      const winSel = window.getSelection()?.toString();
      if (winSel && !winSel.includes('\n')) {
        selected = winSel.trim();
      }
    }

    if (selected) {
      setSearchQuery(selected);
    }

    setIsFindOpen(true);
    if (withReplace) setIsReplaceOpen(true);
    setIsGoToLineOpen(false);

    setTimeout(() => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }, 50);
  }, [isEditing]);

  // Global Keyboard Shortcuts for CodeViewer
  const handleContainerKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Ctrl+F or Cmd+F -> Find
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      openFind(false);
      return;
    }

    // Ctrl+H or Cmd+H -> Replace
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
      e.preventDefault();
      openFind(true);
      return;
    }

    // Ctrl+G -> Go to Line
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'g') {
      e.preventDefault();
      setIsGoToLineOpen(true);
      setIsFindOpen(false);
      setTimeout(() => {
        goToLineInputRef.current?.focus();
        goToLineInputRef.current?.select();
      }, 50);
      return;
    }

    // F3 -> Next Match, Shift+F3 -> Prev Match
    if (e.key === 'F3') {
      e.preventDefault();
      if (e.shiftKey) handlePrevMatch();
      else handleNextMatch();
      return;
    }

    // Escape -> Close open bars
    if (e.key === 'Escape') {
      if (isFindOpen || isGoToLineOpen) {
        e.preventDefault();
        setIsFindOpen(false);
        setIsGoToLineOpen(false);
        if (isEditing && textareaRef.current) {
          textareaRef.current.focus();
        }
      }
    }
  };

  // Keyboard ergonomics inside Textarea
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

  // Track cursor position in Textarea
  const updateCursorPosition = () => {
    if (!textareaRef.current) return;
    const pos = textareaRef.current.selectionStart;
    const textUpToCursor = editedCode.substring(0, pos);
    const curLines = textUpToCursor.split('\n');
    const curLine = curLines.length;
    const curCol = curLines[curLines.length - 1].length + 1;
    setCursorInfo({ line: curLine, col: curCol });
  };

  // Synchronize scroll positions
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

  const handleCopy = () => {
    navigator.clipboard.writeText(activeDisplayCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    const original = viewMode === 'clean' && cleanCode ? cleanCode : code;
    setEditedCode(original);
  };

  // --- Token Slicing & Search Highlighting Helper ---
  const sliceToken = (
    tok: string,
    tokenStart: number,
    tokenEnd: number,
    lineMatches: SearchMatch[] | undefined,
    currentMatchId: number,
    baseClass?: string
  ): React.ReactNode => {
    if (!lineMatches || lineMatches.length === 0) {
      return <span className={baseClass}>{tok}</span>;
    }

    const overlapping = lineMatches.filter(
      (m) => m.colStart < tokenEnd && m.colEnd > tokenStart
    );

    if (overlapping.length === 0) {
      return <span className={baseClass}>{tok}</span>;
    }

    const parts: React.ReactNode[] = [];
    let cur = tokenStart;

    overlapping.forEach((m, idx) => {
      const matchStartInTok = Math.max(tokenStart, m.colStart);
      const matchEndInTok = Math.min(tokenEnd, m.colEnd);

      if (matchStartInTok > cur) {
        parts.push(
          <span key={`pre-${idx}`} className={baseClass}>
            {tok.substring(cur - tokenStart, matchStartInTok - tokenStart)}
          </span>
        );
      }

      if (matchEndInTok > matchStartInTok) {
        const isCurrent = m.id === currentMatchId;
        parts.push(
          <mark
            key={`match-${m.id}`}
            className={`px-0.5 rounded-[2px] transition-colors select-text ${
              isCurrent
                ? 'bg-[#F59E0B] text-black font-bold ring-2 ring-amber-300'
                : 'bg-amber-400/35 text-amber-100 ring-1 ring-amber-400/50'
            }`}
          >
            {tok.substring(matchStartInTok - tokenStart, matchEndInTok - tokenStart)}
          </mark>
        );
      }

      cur = matchEndInTok;
    });

    if (cur < tokenEnd) {
      parts.push(
        <span key="post" className={baseClass}>
          {tok.substring(cur - tokenStart, tokenEnd - tokenStart)}
        </span>
      );
    }

    return parts;
  };

  // Syntax highlighting line formatter with embedded search highlights
  const renderHighlightedLine = (line: string, lineIndex: number) => {
    if (!line) {
      return <span>&nbsp;</span>;
    }

    const lineMatches = lineMatchesMap.get(lineIndex);
    const currentMatchId = activeMatch ? activeMatch.id : -1;

    // Full Line Comment
    if (line.trim().startsWith('//')) {
      return (
        <span key={lineIndex}>
          {sliceToken(line, 0, line.length, lineMatches, currentMatchId, 'text-[#676E6A] italic')}
        </span>
      );
    }

    // Split line by string literals, block comments, and inline comments
    const stringParts = line.split(/("(?:[^"\\]|\\.)*"|\/\*.*?\*\/|\/\/.*$)/g);
    let currentCol = 0;

    return (
      <span key={lineIndex}>
        {stringParts.map((part, pIdx) => {
          if (!part) return null;
          const partStart = currentCol;
          const partEnd = currentCol + part.length;
          currentCol = partEnd;

          // Inline or trailing comment
          if (part.startsWith('//')) {
            return (
              <span key={pIdx}>
                {sliceToken(part, partStart, partEnd, lineMatches, currentMatchId, 'text-[#676E6A] italic select-text')}
              </span>
            );
          }

          // String Literal
          if (part.startsWith('"') && part.endsWith('"')) {
            return (
              <span key={pIdx}>
                {sliceToken(part, partStart, partEnd, lineMatches, currentMatchId, 'text-amber-300 font-medium select-text')}
              </span>
            );
          }

          // Block Comment /* ... */
          if (part.startsWith('/*') && part.endsWith('*/')) {
            return (
              <span key={pIdx}>
                {sliceToken(part, partStart, partEnd, lineMatches, currentMatchId, 'text-[#6E9B7B]/90 italic font-semibold select-text')}
              </span>
            );
          }

          // Code Tokens
          const tokens = part.split(
            /(\b(?:public|private|protected|internal|virtual|override|abstract|static|sealed|class|struct|interface|enum|void|int|float|bool|string|long|uint|ulong|byte|sbyte|short|ushort|char|double|decimal|object|const|readonly|return|if|else|while|for|foreach|switch|case|break|continue|new|this|null|true|false|sizeof|typeof|nullptr|async|await|using|namespace|get|set|value|var|params|ref|out|in|is|as|try|catch|finally|throw|goto|default|__int64|__int32|__int16|__int8|_QWORD|_DWORD|_WORD|_BYTE|BYREF|MethodInfo|Il2CppObject|Il2CppString|Il2CppClass|Il2CppArray|uintptr_t|intptr_t|size_t)\b|0x[0-9A-Fa-f]+|\b\d+(?:\.\d+)?f?\b|\b[A-Za-z0-9_]+_o\b|\b[A-Za-z0-9_]+(?=\()|->|=>|\+\+|--|==|!=|<=|>=|&&|\|\||[{}();,])/g
          );

          let tokCol = partStart;

          return (
            <span key={pIdx}>
              {tokens.map((tok, tIdx) => {
                if (!tok) return null;
                const tokStart = tokCol;
                const tokEnd = tokCol + tok.length;
                tokCol = tokEnd;

                // Keywords
                if (/^(public|private|protected|internal|virtual|override|abstract|static|sealed|class|struct|interface|enum|void|const|readonly|return|if|else|while|for|foreach|switch|case|break|continue|new|this|null|true|false|nullptr|async|await|using|namespace|get|set|value|var|params|ref|out|in|is|as|try|catch|finally|throw|goto|default)$/.test(tok)) {
                  return (
                    <span key={tIdx}>
                      {sliceToken(tok, tokStart, tokEnd, lineMatches, currentMatchId, 'text-sky-400 font-semibold')}
                    </span>
                  );
                }

                // Types & Structs
                if (/^(int|float|bool|string|long|uint|ulong|byte|sbyte|short|ushort|char|double|decimal|object|__int64|__int32|__int16|__int8|_QWORD|_DWORD|_WORD|_BYTE|BYREF|MethodInfo|Il2CppObject|Il2CppString|Il2CppClass|Il2CppArray|uintptr_t|intptr_t|size_t)$/.test(tok) || tok.endsWith('_o')) {
                  return (
                    <span key={tIdx}>
                      {sliceToken(tok, tokStart, tokEnd, lineMatches, currentMatchId, 'text-emerald-400 font-medium')}
                    </span>
                  );
                }

                // Numbers
                if (/^(0x[0-9A-Fa-f]+|\d+(?:\.\d+)?f?)$/.test(tok)) {
                  return (
                    <span key={tIdx}>
                      {sliceToken(tok, tokStart, tokEnd, lineMatches, currentMatchId, 'text-fuchsia-400 font-mono')}
                    </span>
                  );
                }

                // Pointers & Arrows
                if (tok === '->' || tok === '=>') {
                  return (
                    <span key={tIdx}>
                      {sliceToken(tok, tokStart, tokEnd, lineMatches, currentMatchId, 'text-rose-400 font-bold')}
                    </span>
                  );
                }

                // Method Calls
                if (/^[A-Za-z0-9_]+$/.test(tok) && part[part.indexOf(tok) + tok.length] === '(') {
                  return (
                    <span
                      key={tIdx}
                      onClick={() => !isEditing && onSymbolClick && onSymbolClick(tok)}
                      className={!isEditing && onSymbolClick ? 'cursor-pointer hover:underline hover:text-accent' : ''}
                      title={!isEditing && onSymbolClick ? `Jump to ${tok}` : undefined}
                    >
                      {sliceToken(tok, tokStart, tokEnd, lineMatches, currentMatchId, 'text-amber-200')}
                    </span>
                  );
                }

                return (
                  <span key={tIdx}>
                    {sliceToken(tok, tokStart, tokEnd, lineMatches, currentMatchId, '')}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      onKeyDown={handleContainerKeyDown}
      className="flex flex-col h-full rounded border border-[#2C3236] bg-[#0d1117] overflow-hidden text-xs font-mono outline-none focus:ring-1 focus:ring-[#C49B66]/30"
    >
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

        {/* Action & Search Buttons */}
        <div className="flex items-center gap-1.5">
          {/* Find Button */}
          <button
            type="button"
            onClick={() => openFind(false)}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1 cursor-default ${
              isFindOpen && !isReplaceOpen
                ? 'bg-[#C49B66]/20 border-[#C49B66] text-[#C49B66]'
                : 'border-[#2C3236] bg-[#0d1117] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#4B5563]'
            }`}
            title="Find in code (Ctrl+F)"
          >
            <Search className="w-3 h-3" />
            <span>Find</span>
          </button>

          {/* Replace Button */}
          <button
            type="button"
            onClick={() => openFind(true)}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1 cursor-default ${
              isFindOpen && isReplaceOpen
                ? 'bg-[#C49B66]/20 border-[#C49B66] text-[#C49B66]'
                : 'border-[#2C3236] bg-[#0d1117] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#4B5563]'
            }`}
            title="Find & Replace in code (Ctrl+H)"
          >
            <Replace className="w-3 h-3" />
            <span>Replace</span>
          </button>

          {/* Go to Line Button */}
          <button
            type="button"
            onClick={() => {
              setIsGoToLineOpen(!isGoToLineOpen);
              if (!isGoToLineOpen) {
                setTimeout(() => goToLineInputRef.current?.focus(), 50);
              }
            }}
            className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors flex items-center gap-1 cursor-default ${
              isGoToLineOpen
                ? 'bg-[#C49B66]/20 border-[#C49B66] text-[#C49B66]'
                : 'border-[#2C3236] bg-[#0d1117] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#4B5563]'
            }`}
            title="Go to Line (Ctrl+G)"
          >
            <Hash className="w-3 h-3" />
            <span>Line</span>
          </button>

          <span className="text-[#2C3236] mx-0.5">|</span>

          {isEditing && (
            <button
              type="button"
              onClick={handleReset}
              className="px-2 py-1 rounded bg-[#0d1117] border border-[#2C3236] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#4B5563] cursor-default flex items-center gap-1 text-[11px]"
              title="Revert scratchpad to original decompiled source code"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
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
            <span>{copied ? 'Copied!' : 'Copy'}</span>
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

      {/* Find & Replace Dock Widget */}
      {isFindOpen && (
        <div className="bg-[#161b22] border-b border-[#30363d] p-2.5 select-none shadow-md z-20">
          {/* Row 1: Search & Navigation */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Expand / Collapse Replace */}
            <button
              type="button"
              onClick={() => setIsReplaceOpen(!isReplaceOpen)}
              className="p-1 rounded text-[#9FA6A2] hover:text-[#E6E8E6] hover:bg-[#21262d] transition-colors"
              title={isReplaceOpen ? 'Collapse Replace Bar' : 'Expand Replace Bar (Ctrl+H)'}
            >
              {isReplaceOpen ? <ChevronDown className="w-3.5 h-3.5 text-[#C49B66]" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>

            {/* Search Input Box */}
            <div className="relative flex-1 min-w-[220px] flex items-center">
              <Search className="w-3.5 h-3.5 text-[#676E6A] absolute left-2.5 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (e.shiftKey) handlePrevMatch();
                    else handleNextMatch();
                  }
                }}
                placeholder="Find in code (Enter for next, Shift+Enter for prev)..."
                className={`control-input w-full pl-8 pr-24 py-1 text-xs font-mono bg-[#0d1117] border ${
                  regexError ? 'border-rose-500/80 text-rose-300' : 'border-[#30363d] focus:border-[#C49B66]'
                }`}
              />

              {/* Match Options: Aa, \b, .* */}
              <div className="absolute right-1.5 flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setMatchCase(!matchCase)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    matchCase ? 'bg-[#C49B66] text-black shadow-sm' : 'text-[#676E6A] hover:text-[#E6E8E6]'
                  }`}
                  title="Match Case (Alt+C)"
                >
                  Aa
                </button>
                <button
                  type="button"
                  onClick={() => setMatchWholeWord(!matchWholeWord)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    matchWholeWord ? 'bg-[#C49B66] text-black shadow-sm' : 'text-[#676E6A] hover:text-[#E6E8E6]'
                  }`}
                  title="Match Whole Word (Alt+W)"
                >
                  \b
                </button>
                <button
                  type="button"
                  onClick={() => setUseRegex(!useRegex)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-colors ${
                    useRegex ? 'bg-[#C49B66] text-black shadow-sm' : 'text-[#676E6A] hover:text-[#E6E8E6]'
                  }`}
                  title="Use Regular Expression (Alt+R)"
                >
                  .*
                </button>
              </div>
            </div>

            {/* Match Counter Badge */}
            <div className="text-[11px] font-mono px-2 py-1 rounded bg-[#0d1117] border border-[#30363d] text-[#9FA6A2] shrink-0 min-w-[75px] text-center">
              {regexError ? (
                <span className="text-rose-400">Regex Error</span>
              ) : searchQuery ? (
                matches.length > 0 ? (
                  <span className="text-[#E6E8E6] font-semibold">
                    {currentMatchIndex + 1} of {matches.length}
                  </span>
                ) : (
                  <span className="text-rose-400">0 results</span>
                )
              ) : (
                <span className="text-[#676E6A]">No query</span>
              )}
            </div>

            {/* Navigation Arrows */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handlePrevMatch}
                disabled={matches.length === 0}
                className="p-1 rounded border border-[#30363d] bg-[#0d1117] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#C49B66] disabled:opacity-40 transition-colors"
                title="Previous Match (Shift+Enter / Shift+F3)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleNextMatch}
                disabled={matches.length === 0}
                className="p-1 rounded border border-[#30363d] bg-[#0d1117] text-[#9FA6A2] hover:text-[#E6E8E6] hover:border-[#C49B66] disabled:opacity-40 transition-colors"
                title="Next Match (Enter / F3)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsFindOpen(false)}
              className="p-1 rounded text-[#9FA6A2] hover:text-rose-400 hover:bg-[#21262d] transition-colors ml-1"
              title="Close Find (Esc)"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Row 2: Replace Controls */}
          {isReplaceOpen && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#30363d]/60 flex-wrap sm:flex-nowrap">
              <div className="w-5 shrink-0" /> {/* Spacer */}
              <div className="relative flex-1 min-w-[220px]">
                <Replace className="w-3.5 h-3.5 text-[#676E6A] absolute left-2.5 top-2 pointer-events-none" />
                <input
                  ref={replaceInputRef}
                  type="text"
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (e.ctrlKey || e.metaKey) handleReplaceAll();
                      else handleReplaceOne();
                    }
                  }}
                  placeholder="Replace with..."
                  className="control-input w-full pl-8 pr-2 py-1 text-xs font-mono bg-[#0d1117] border border-[#30363d] focus:border-[#C49B66]"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleReplaceOne}
                  disabled={matches.length === 0}
                  className="px-2.5 py-1 rounded border border-[#30363d] bg-[#0d1117] text-[11px] font-medium text-[#E6E8E6] hover:bg-[#21262d] hover:border-[#C49B66] disabled:opacity-40 flex items-center gap-1 transition-colors cursor-default"
                  title="Replace current match and advance to next (Enter in replace box)"
                >
                  <Replace className="w-3 h-3 text-[#C49B66]" />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  onClick={handleReplaceAll}
                  disabled={matches.length === 0}
                  className="px-2.5 py-1 rounded border border-[#C49B66]/40 bg-[#C49B66]/10 text-[11px] font-medium text-[#C49B66] hover:bg-[#C49B66]/20 disabled:opacity-40 flex items-center gap-1 transition-colors cursor-default"
                  title="Replace all occurrences in document (Ctrl+Enter)"
                >
                  <ReplaceAll className="w-3 h-3" />
                  <span>Replace All</span>
                </button>
              </div>

              {/* Replace Notice */}
              {replaceNotice && (
                <span className="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 shrink-0">
                  {replaceNotice}
                </span>
              )}

              {!isEditing && (
                <span className="text-[10px] text-amber-400/90 font-mono hidden md:inline shrink-0">
                  ⚡ Replacing will automatically activate Scratchpad mode
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Go to Line Bar */}
      {isGoToLineOpen && (
        <div className="bg-[#161b22] border-b border-[#30363d] px-3 py-2 select-none flex items-center gap-2.5 shadow-md z-20">
          <Hash className="w-3.5 h-3.5 text-[#C49B66]" />
          <span className="text-xs text-[#9FA6A2]">Go to Line:</span>
          <input
            ref={goToLineInputRef}
            type="number"
            min={1}
            max={lines.length}
            value={goToLineNumber}
            onChange={(e) => setGoToLineNumber(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGoToLine();
              if (e.key === 'Escape') setIsGoToLineOpen(false);
            }}
            placeholder={`1 - ${lines.length}`}
            className="control-input w-28 px-2 py-0.5 text-xs font-mono bg-[#0d1117] border border-[#30363d] focus:border-[#C49B66]"
          />
          <button
            type="button"
            onClick={handleGoToLine}
            className="btn-secondary-action px-2.5 py-0.5 text-xs font-medium cursor-default"
          >
            Go
          </button>
          <span className="text-[10px] text-[#676E6A]">Press [Enter] to jump • [Esc] to cancel</span>
          <button
            type="button"
            onClick={() => setIsGoToLineOpen(false)}
            className="ml-auto p-1 rounded text-[#9FA6A2] hover:text-rose-400 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

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
            Press [Tab] for 4 spaces • [Ctrl+F] Find • [Ctrl+H] Replace • Click &quot;Reset&quot; to restore
          </span>
        </div>
      )}

      {/* Code Display & Scratchpad Editor Area */}
      <div
        className="flex-1 overflow-hidden relative flex bg-[#0d1117]"
        style={{ fontSize: `${fontSize}px` }}
      >
        {isEditing ? (
          /* SYNTAX-HIGHLIGHTED EDITABLE SCRATCHPAD */
          <div className="flex-1 flex overflow-hidden relative">
            {/* Synchronized Line Numbers Gutter */}
            <div
              ref={lineNumbersRef}
              className="w-12 shrink-0 overflow-hidden bg-[#0d1117] border-r border-[#21262d] select-none text-right pr-3 py-3 text-[11px] font-mono text-[#676E6A]/70"
            >
              {lines.map((_, idx) => (
                <div
                  key={idx}
                  style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                  className={idx === flashedLine ? 'text-[#C49B66] font-bold' : ''}
                >
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
                style={{
                  tabSize: 4,
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeight}px`
                }}
                className={`absolute inset-0 m-0 p-3 overflow-hidden font-mono pointer-events-none select-none ${
                  isWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                }`}
              >
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    style={{ height: isWordWrap ? 'auto' : `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                    className={`${isWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'} ${
                      idx === flashedLine ? 'bg-[#C49B66]/25 border-l-2 border-[#C49B66] transition-colors duration-500' : ''
                    }`}
                  >
                    {line ? renderHighlightedLine(line, idx) : <span>&nbsp;</span>}
                  </div>
                ))}
              </pre>

              {/* Layer 2 (On Top): Transparent Interactive Textarea */}
              <textarea
                ref={textareaRef}
                value={editedCode}
                onChange={(e) => {
                  setEditedCode(e.target.value);
                  updateCursorPosition();
                }}
                onSelect={updateCursorPosition}
                onClick={updateCursorPosition}
                onKeyUp={updateCursorPosition}
                onScroll={handleScroll}
                onKeyDown={handleTextareaKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                style={{
                  tabSize: 4,
                  fontSize: `${fontSize}px`,
                  lineHeight: `${lineHeight}px`
                }}
                className={`absolute inset-0 w-full h-full m-0 p-3 bg-transparent font-mono text-transparent caret-[#E6E8E6] selection:bg-[#C49B66]/35 selection:text-transparent resize-none outline-none border-0 overflow-auto z-10 select-text ${
                  isWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                }`}
              />
            </div>
          </div>
        ) : (
          /* READ-ONLY SYNTAX-HIGHLIGHTED VIEW */
          <div
            ref={readOnlyContainerRef}
            className="flex-1 overflow-auto p-3.5 select-text min-w-full"
            style={{ fontSize: `${fontSize}px`, lineHeight: `${lineHeight}px` }}
          >
            {lines.map((line, idx) => (
              <div
                key={idx}
                style={{ lineHeight: `${lineHeight}px` }}
                className={`flex hover:bg-[#161b22]/60 rounded px-1 -mx-1 group ${
                  idx === flashedLine ? 'bg-[#C49B66]/25 border-l-2 border-[#C49B66] transition-colors duration-500' : ''
                }`}
              >
                <span
                  style={{ height: `${lineHeight}px`, lineHeight: `${lineHeight}px` }}
                  className="w-10 shrink-0 text-right pr-3 text-[#676E6A]/60 select-none text-[11px] group-hover:text-[#9FA6A2]"
                >
                  {idx + 1}
                </span>
                <span
                  style={{ lineHeight: `${lineHeight}px` }}
                  className={`flex-1 select-text font-mono ${
                    isWordWrap ? 'whitespace-pre-wrap break-all' : 'whitespace-pre'
                  }`}
                >
                  {renderHighlightedLine(line, idx)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Editor Status Bar & Telemetry Footer */}
      <div className="h-6 px-3 bg-[#161b22] border-t border-[#2C3236] flex items-center justify-between text-[11px] font-mono text-[#676E6A] select-none shrink-0">
        <div className="flex items-center gap-2.5">
          {isEditing ? (
            <span className="text-[#9FA6A2]">
              Ln <strong className="text-[#E6E8E6]">{cursorInfo.line}</strong>, Col <strong className="text-[#E6E8E6]">{cursorInfo.col}</strong>
            </span>
          ) : (
            <span className="text-[#9FA6A2]">Read-Only</span>
          )}
          <span>•</span>
          <span>{lines.length.toLocaleString()} lines</span>
          <span>•</span>
          <span>{activeDisplayCode.length.toLocaleString()} chars</span>
          {matches.length > 0 && searchQuery && (
            <>
              <span>•</span>
              <span className="text-amber-400 font-semibold">
                Match {currentMatchIndex + 1}/{matches.length}
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Word Wrap Toggle */}
          <button
            type="button"
            onClick={() => setIsWordWrap(!isWordWrap)}
            className={`hover:text-[#E6E8E6] transition-colors flex items-center gap-1 cursor-default ${
              isWordWrap ? 'text-[#C49B66] font-semibold' : ''
            }`}
            title="Toggle Word Wrap"
          >
            <WrapText className="w-3 h-3" />
            <span>{isWordWrap ? 'Wrap: On' : 'Wrap: Off'}</span>
          </button>

          {/* Font Zoom Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFontSize(Math.max(10, fontSize - 1))}
              className="p-0.5 hover:text-[#E6E8E6] cursor-default"
              title="Decrease font size"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[#9FA6A2] min-w-[26px] text-center">{fontSize}px</span>
            <button
              type="button"
              onClick={() => setFontSize(Math.min(18, fontSize + 1))}
              className="p-0.5 hover:text-[#E6E8E6] cursor-default"
              title="Increase font size"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>

          <span className="hidden lg:inline text-[10px] text-[#676E6A]">
            Ctrl+F Find • Ctrl+H Replace • Ctrl+G Line
          </span>
        </div>
      </div>
    </div>
  );
};
