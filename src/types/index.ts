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
  hasDumpV2?: boolean;
  dumpV2Size?: number;
  dumpCsSize?: number;
  defaultSource?: 'dumpv2.cs' | 'dump.cs';
}

export interface SearchResult {
  line: number;
  content: string;
}

export interface MethodParam {
  name: string;
  type: string;
  defaultValue?: string | null;
  raw?: string;
}

export interface SymbolItem {
  symbolType: 'method' | 'field' | 'class' | 'method-body';
  bodySnippet?: string;
  name: string;
  kind?: string;
  signature: string;
  access?: string;
  modifier?: string;
  returnType?: string;
  fieldType?: string;
  parameters: MethodParam[];
  paramCount: number;
  rva?: string | null;
  offset?: string | null;
  va?: string | null;
  slot?: string | null;
  fieldOffset?: string | null;
  enclosingClass: string;
  baseClass?: string | null;
  childClasses?: string[];
  childCount: number;
  interfaces?: string[];
  namespace?: string;
  dll: string;
  typeDefIndex?: number;
  line: number;
}

export interface ClassField {
  access: string;
  modifier?: string;
  type: string;
  name: string;
  offset?: string | null;
  raw: string;
}

export interface ClassMethod {
  access: string;
  modifier?: string;
  returnType: string;
  name: string;
  parameters: MethodParam[];
  paramCount: number;
  rva?: string | null;
  offset?: string | null;
  slot?: string | null;
  raw: string;
  body?: string;
  cleanBody?: string;
  isDecompiled?: boolean;
}

export interface ClassDetail {
  meta: {
    name: string;
    kind: string;
    access?: string;
    modifier?: string;
    namespace: string;
    baseClass?: string | null;
    interfaces: string[];
    dll: string;
    typeDefIndex: number;
    childClasses: string[];
    childCount: number;
    startLine?: number;
    endLine?: number | null;
  };
  fields: ClassField[];
  methods: ClassMethod[];
  properties: { raw: string }[];
  sourceCode: string;
  cleanSourceCode?: string;
  isDecompiledClass?: boolean;
  decompiledMethodCount?: number;
  totalMethods?: number;
  sourceFile?: string;
}

export interface DllClassSummary {
  name: string;
  kind: string;
  namespace: string;
  baseClass?: string | null;
  interfaces: string[];
  typeDefIndex: number;
  childCount: number;
}

export interface IndexingStatus {
  isIndexing: boolean;
  phase: 'idle' | 'indexing' | 'ready';
  targetFile: string;
  percent: number;
  classesCount: number;
  methodsCount: number;
  fieldsCount: number;
  linesRead: number;
  tookMs: number;
}

export interface HeaderCandidate {
  offset: number;
  offsetHex: string;
  magicHex: string;
  magicName: string;
  isEa: boolean;
  version: number;
  headerSize: number;
  stringLiteralOffset: string;
  stringLiteralDataOffset: string;
  stringOffset: string;
  stringSize: number;
  eventsOffset: string;
  propertiesOffset: string;
  methodsOffset: string;
  isValid: boolean;
  previewHex: string;
}

export interface FixMetadataResult {
  success: boolean;
  outputPath: string;
  fileSize: number;
  headerOffset: number;
  headerSize: number;
  patched: boolean;
  originalMagic: string;
  finalMagic: string;
  version: number;
  origHeaderPreview: string;
  newHeaderPreview: string;
}

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      browseFile: (options?: { title?: string; filter?: Array<{ name: string; extensions: string[] }> }) => Promise<{ selectedPath?: string; cancelled?: boolean }>;
      browseFolder: (options?: { title?: string }) => Promise<{ selectedPath?: string; cancelled?: boolean }>;
      openFolder: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
      minimizeWindow?: () => Promise<void>;
      maximizeWindow?: () => Promise<boolean>;
      closeWindow?: () => Promise<void>;
      isMaximized?: () => Promise<boolean>;
    };
  }
}
