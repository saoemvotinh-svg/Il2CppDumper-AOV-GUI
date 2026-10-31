import React from 'react';
import { Sliders, Check } from 'lucide-react';
import type { DumperConfig } from '../types';

interface EngineConfigProps {
  config: DumperConfig;
  setConfig: React.Dispatch<React.SetStateAction<DumperConfig>>;
}

export const EngineConfig: React.FC<EngineConfigProps> = ({ config, setConfig }) => {
  const toggleKey = (key: keyof DumperConfig) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const options: { key: keyof DumperConfig; label: string; detail: string }[] = [
    { key: 'DumpMethod', label: 'DumpMethod', detail: 'Function RVA & signatures' },
    { key: 'DumpField', label: 'DumpField', detail: 'Struct fields & layout definitions' },
    { key: 'DumpFieldOffset', label: 'DumpFieldOffset', detail: 'Real struct memory offsets' },
    { key: 'GenerateDummyDll', label: 'GenerateDummyDll', detail: '89 assemblies for dnSpy' },
    { key: 'GenerateScript', label: 'GenerateScript', detail: 'IDA Pro & Ghidra symbol maps' },
    { key: 'DumpProperty', label: 'DumpProperty', detail: 'Properties, getters & setters' },
    { key: 'DumpAttribute', label: 'DumpAttribute', detail: 'Custom IL2CPP metadata attributes' },
    { key: 'autoTencentXor', label: 'Tencent XOR Filter', detail: 'Auto-decode 0x69696969 offsets' },
  ];

  return (
    <section className="panel-frame">
      <div className="panel-header flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="w-3.5 h-3.5 text-accent" />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-primary">
            Engine Configuration & Decompiler Flags
          </h2>
        </div>
        <div className="text-[11px] font-mono text-ink-secondary">
          Pipeline Mode: <span className="text-ink-primary">Sequential Recovery</span>
        </div>
      </div>

      <div className="p-3.5 grid grid-cols-2 md:grid-cols-4 gap-2.5">
        {options.map(({ key, label, detail }) => {
          const isChecked = Boolean(config[key]);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggleKey(key)}
              className={`p-2.5 rounded border text-left flex items-start gap-2.5 transition-colors cursor-pointer select-none ${
                isChecked
                  ? 'bg-app-elevated border-app-border'
                  : 'bg-app-workspace border-app-border/60 hover:bg-app-elevated/40'
              }`}
            >
              <div
                className={`w-3.5 h-3.5 mt-0.5 rounded-sm border flex items-center justify-center transition-colors shrink-0 ${
                  isChecked
                    ? 'bg-accent border-accent text-app-bg'
                    : 'bg-app-workspace border-app-border'
                }`}
              >
                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-medium font-mono text-ink-primary truncate">
                  {label}
                </div>
                <div className="text-[11px] text-ink-secondary truncate mt-0.5">
                  {detail}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
