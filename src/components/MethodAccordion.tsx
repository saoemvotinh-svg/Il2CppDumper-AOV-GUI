import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Check, Sparkles, Code2 } from 'lucide-react';
import type { ClassMethod } from '../types';
import { CodeViewer } from './CodeViewer';

interface MethodAccordionProps {
  method: ClassMethod;
  copiedText: string | null;
  onCopy: (text: string) => void;
  onSymbolClick?: (symbolName: string) => void;
}

export const MethodAccordion: React.FC<MethodAccordionProps> = ({
  method,
  copiedText,
  onCopy,
  onSymbolClick
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const hasBody = Boolean(method.body && method.body.trim() !== '{ }' && method.body.trim() !== '');

  return (
    <div className="rounded border border-app-border bg-app-elevated/40 hover:bg-app-elevated/70 transition-all overflow-hidden">
      {/* Header Row */}
      <div
        onClick={() => hasBody && setIsOpen(!isOpen)}
        className={`p-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 select-none ${
          hasBody ? 'cursor-pointer' : ''
        }`}
      >
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Expand / Collapse Icon */}
            {hasBody ? (
              <span className="text-accent pr-0.5">
                {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
            ) : (
              <span className="w-3.5 h-3.5 inline-block" />
            )}

            <span className="text-[10px] text-ink-muted uppercase">{method.access}</span>
            {method.modifier && (
              <span className="text-[10px] text-accent uppercase">{method.modifier}</span>
            )}
            <span className="text-status-ready font-medium select-text">{method.returnType}</span>
            <span className="font-semibold text-ink-primary select-text">{method.name}</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(method.name);
              }}
              className="p-0.5 text-ink-muted hover:text-ink-primary cursor-pointer"
              title="Copy method name"
            >
              <Copy className="w-2.5 h-2.5" />
            </button>

            <span className="text-ink-secondary select-text">
              ({method.parameters.map((p) => `${p.type} ${p.name}`).join(', ')})
            </span>

            {/* Decompiled Badge */}
            {method.isDecompiled ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/40 text-emerald-400">
                <Sparkles className="w-2.5 h-2.5" />
                <span>Hex-Rays Body</span>
              </span>
            ) : (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] text-ink-muted bg-app-workspace border border-app-border">
                Stub / Abstract
              </span>
            )}
          </div>

          <div className="text-[11px] text-ink-muted flex items-center gap-3 pl-4">
            <div className="flex items-center gap-1">
              <span>Params ({method.paramCount})</span>
              {method.paramCount > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(method.parameters.map((p) => `${p.type} ${p.name}`).join(', '));
                  }}
                  className="text-ink-secondary hover:text-ink-primary flex items-center gap-0.5 cursor-pointer"
                  title="Copy parameters list"
                >
                  <Copy className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
            {method.slot && <span>Slot: {method.slot}</span>}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(method.raw);
              }}
              className="text-ink-secondary hover:text-accent flex items-center gap-1 cursor-pointer"
              title="Copy full method signature"
            >
              <span>Copy Sig</span>
              <Copy className="w-2.5 h-2.5" />
            </button>
            {hasBody && (
              <span className="text-accent text-[10px] flex items-center gap-0.5 ml-2">
                <Code2 className="w-3 h-3" />
                <span>{isOpen ? 'Thu gọn' : 'Xem Thân Hàm'}</span>
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {method.rva && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(method.rva!);
              }}
              className="px-2 py-0.5 rounded text-[11px] bg-app-bg hover:bg-app-elevatedHover border border-app-border text-ink-secondary hover:text-accent cursor-pointer flex items-center gap-1"
              title="Copy RVA"
            >
              {copiedText === method.rva ? (
                <Check className="w-3 h-3 text-status-ready" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span className="select-text">RVA: {method.rva}</span>
            </button>
          )}
          {method.offset && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCopy(method.offset!);
              }}
              className="px-2 py-0.5 rounded text-[11px] bg-app-bg hover:bg-app-elevatedHover border border-app-border text-ink-secondary hover:text-accent cursor-pointer flex items-center gap-1"
              title="Copy File Offset"
            >
              {copiedText === method.offset ? (
                <Check className="w-3 h-3 text-status-ready" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
              <span className="select-text">Offset: {method.offset}</span>
            </button>
          )}
        </div>
      </div>

      {/* Accordion Body */}
      {isOpen && hasBody && (
        <div className="border-t border-app-border p-2 bg-[#0d1117]/80">
          <CodeViewer
            code={method.raw + (method.body ? '\n' + method.body : '')}
            cleanCode={method.raw + (method.cleanBody ? '\n' + method.cleanBody : '')}
            fileName={`${method.name}.cs`}
            isDecompiled={method.isDecompiled}
            onSymbolClick={onSymbolClick}
          />
        </div>
      )}
    </div>
  );
};
