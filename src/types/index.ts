export interface DumperConfig {
  DumpMethod: boolean;
  DumpField: boolean;
  DumpProperty: boolean;
  DumpAttribute: boolean;
  DumpFieldOffset: boolean;
  DumpMethodOffset: boolean;
  DumpTypeDefIndex: boolean;
  GenerateDummyDll: boolean;
  GenerateScript: boolean;
  DummyDllAddToken: boolean;
  RequireAnyKey: boolean;
  autoTencentXor: boolean;
}

export interface SystemStatus {
  isRunning: boolean;
  defaults: {
    exePath: string;
    exeExists: boolean;
    workspaceDir?: string;
    elfPath: string;
    elfExists: boolean;
    metadataPath: string;
    metadataExists: boolean;
    outputDir: string;
  };
  features: {
    tencentXorDecryption: boolean;
    rvaMinusOneClassification: boolean;
    strippedMethodsAnalysis: boolean;
    dummyDllGeneration: boolean;
    ghidraIdaScripts: boolean;
  };
}

export interface LogEntry {
  timestamp: string;
  line: string;
  level: 'info' | 'warn' | 'error' | 'success' | 'highlight' | 'start';
}

export interface FileArtifact {
  name: string;
  size: number;
  path: string;
  modified: string;
}

export interface ArtifactData {
  exists: boolean;
  directory: string;
  artifacts: FileArtifact[];
  dummyDlls: FileArtifact[];
  totalDlls: number;
}

export interface SearchResult {
  line: number;
  content: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      browseFile: (options?: { title?: string; filter?: Array<{ name: string; extensions: string[] }> }) => Promise<{ selectedPath?: string; cancelled?: boolean }>;
      browseFolder: (options?: { title?: string }) => Promise<{ selectedPath?: string; cancelled?: boolean }>;
      openFolder: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
    };
  }
}
