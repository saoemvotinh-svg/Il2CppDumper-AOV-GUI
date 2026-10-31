const express = require('express');
const cors = require('cors');
const { spawn, execFile, exec } = require('child_process');
const path = require('path');
const fs = require('fs');

function resolveEngineExe() {
  if (process.resourcesPath) {
    const packaged = path.join(process.resourcesPath, 'engine', 'Il2CppDumper.exe');
    if (fs.existsSync(packaged)) return packaged;
  }
  const localEngine = path.join(__dirname, '../engine/Il2CppDumper/bin/Release/net8.0/Il2CppDumper.exe');
  if (fs.existsSync(localEngine)) return localEngine;
  const legacyEngine = path.resolve('..', 'Il2CppDumper-src', 'Il2CppDumper-master', 'Il2CppDumper', 'bin', 'Release', 'net8.0', 'Il2CppDumper.exe');
  if (fs.existsSync(legacyEngine)) return legacyEngine;
  return localEngine;
}

function getAppBaseDir() {
  if (process.resourcesPath) {
    // When packaged in Electron: process.execPath is the .exe
    return path.dirname(process.execPath);
  }
  // In development: project root (Il2CppDumper-Studio)
  return path.resolve(__dirname, '..');
}

function resolveWorkspaceDefaults() {
  const appBase = getAppBaseDir();
  const workspaceDir = path.join(appBase, 'workspace');

  if (!fs.existsSync(workspaceDir)) {
    try {
      fs.mkdirSync(workspaceDir, { recursive: true });
    } catch {}
  }
  const outputDir = path.join(workspaceDir, 'output');
  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch {}
  }

  // 1. Find ELF binary in workspace/ (or workspace/input/)
  let elfPath = path.join(workspaceDir, 'libil2cpp.so');
  let elfExists = fs.existsSync(elfPath);

  if (!elfExists) {
    try {
      const candidates = fs.readdirSync(workspaceDir);
      const foundSo = candidates.find(f => f.endsWith('.so'));
      if (foundSo) {
        elfPath = path.join(workspaceDir, foundSo);
        elfExists = true;
      }
    } catch {}
  }

  // 2. Find metadata in workspace/ (or workspace/input/)
  let metadataPath = path.join(workspaceDir, 'global-metadata.dat');
  let metadataExists = fs.existsSync(metadataPath);

  if (!metadataExists) {
    try {
      const candidates = fs.readdirSync(workspaceDir);
      const foundDat = candidates.find(f => f.endsWith('.dat'));
      if (foundDat) {
        metadataPath = path.join(workspaceDir, foundDat);
        metadataExists = true;
      }
    } catch {}
  }

  return {
    workspaceDir,
    elfPath,
    elfExists,
    metadataPath,
    metadataExists,
    outputDir,
  };
}

let sseClients = [];
let executionLogs = [];
let isRunning = false;
let currentProcess = null;

function broadcastLog(line, level = 'info') {
  const timestamp = new Date().toLocaleTimeString();
  const entry = { timestamp, line, level };
  executionLogs.push(entry);
  if (executionLogs.length > 3000) executionLogs.shift();

  const data = JSON.stringify(entry);
  sseClients.forEach(client => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch {}
  });
}

function createBridgeApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Static files from dist
  const distPath = path.join(__dirname, '../dist');
  if (fs.existsSync(distPath)) {
    app.use(express.static(distPath));
  }

  // SSE endpoint
  app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    sseClients.push(res);

    executionLogs.forEach(entry => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    });

    req.on('close', () => {
      sseClients = sseClients.filter(c => c !== res);
    });
  });

  // System Status
  app.get('/api/status', (req, res) => {
    const exePath = resolveEngineExe();
    const exeExists = fs.existsSync(exePath);
    const ws = resolveWorkspaceDefaults();

    res.json({
      isRunning,
      defaults: {
        exePath,
        exeExists,
        workspaceDir: ws.workspaceDir,
        elfPath: ws.elfPath,
        elfExists: ws.elfExists,
        metadataPath: ws.metadataPath,
        metadataExists: ws.metadataExists,
        outputDir: ws.outputDir,
      },
      features: {
        tencentXorDecryption: true,
        rvaMinusOneClassification: true,
        strippedMethodsAnalysis: true,
        dummyDllGeneration: true,
        ghidraIdaScripts: true
      }
    });
  });

  // Start Dumper
  app.post('/api/dump', (req, res) => {
    if (isRunning) {
      return res.status(400).json({ error: 'A dump task is currently in progress.' });
    }

    const ws = resolveWorkspaceDefaults();
    const {
      exePath = resolveEngineExe(),
      elfPath = ws.elfPath,
      metadataPath = ws.metadataPath,
      outputDir = ws.outputDir,
      config = {}
    } = req.body;

    if (!fs.existsSync(exePath)) {
      return res.status(400).json({ error: `Il2CppDumper executable not found at: ${exePath}` });
    }
    if (!fs.existsSync(elfPath)) {
      return res.status(400).json({ error: `ELF binary file not found at: ${elfPath}` });
    }
    if (!fs.existsSync(metadataPath)) {
      return res.status(400).json({ error: `global-metadata.dat not found at: ${metadataPath}` });
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const exeDir = path.dirname(exePath);
    const configPath = path.join(exeDir, 'config.json');
    try {
      let currentConfig = {};
      if (fs.existsSync(configPath)) {
        currentConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      }
      const mergedConfig = { ...currentConfig, ...config };
      fs.writeFileSync(configPath, JSON.stringify(mergedConfig, null, 2), 'utf8');
    } catch (err) {
      console.warn('Could not update config.json:', err.message);
    }

    executionLogs = [];
    isRunning = true;
    broadcastLog(`🚀 Starting Il2CppDumper engine...`, 'start');
    broadcastLog(`📦 Binary: ${elfPath}`, 'info');
    broadcastLog(`📄 Metadata: ${metadataPath}`, 'info');
    broadcastLog(`📂 Output: ${outputDir}`, 'info');
    broadcastLog(`⚡ Tencent XOR 0x69696969 De-obfuscation: ENABLED (Auto-Decoded)`, 'highlight');

    const args = [elfPath, metadataPath, outputDir];
    currentProcess = spawn(exePath, args, {
      cwd: exeDir,
      windowsHide: true,
      env: process.env
    });

    currentProcess.stdout.on('data', (data) => {
      const text = data.toString();
      text.split(/\r?\n/).forEach(line => {
        if (line.trim()) {
          let level = 'info';
          if (line.includes('ERROR') || line.includes('Error')) level = 'error';
          else if (line.includes('WARNING') || line.includes('Warn')) level = 'warn';
          else if (line.includes('Done!') || line.includes('Success') || line.includes('100%')) level = 'success';
          else if (line.includes('Initializing') || line.includes('Processing')) level = 'highlight';
          broadcastLog(line, level);
        }
      });
    });

    currentProcess.stderr.on('data', (data) => {
      const text = data.toString();
      text.split(/\r?\n/).forEach(line => {
        if (line.trim()) broadcastLog(line, 'error');
      });
    });

    currentProcess.on('close', (code) => {
      isRunning = false;
      currentProcess = null;
      if (code === 0) {
        copyScriptsToOutput(outputDir);
        broadcastLog(`✨ Il2CppDumper execution completed successfully (Exit code: 0)`, 'success');
      } else {
        broadcastLog(`❌ Il2CppDumper process exited with code ${code}`, 'error');
      }
    });

    currentProcess.on('error', (err) => {
      isRunning = false;
      currentProcess = null;
      broadcastLog(`💥 Failed to execute process: ${err.message}`, 'error');
    });

    res.json({ message: 'Dump process initiated', status: 'started' });
  });

  // Cancel Dumper
  app.post('/api/cancel', (req, res) => {
    if (currentProcess) {
      currentProcess.kill('SIGKILL');
      isRunning = false;
      currentProcess = null;
      broadcastLog('🛑 Dump process cancelled by user.', 'warn');
      return res.json({ message: 'Process cancelled' });
    }
    res.json({ message: 'No active process' });
  });

  function copyScriptsToOutput(targetDir) {
    if (!fs.existsSync(targetDir)) return;
    const scriptFiles = [
      'ida_with_struct_py3.py',
      'ida_py3.py',
      'ida.py',
      'ida_with_struct.py',
      'ghidra.py',
      'ghidra_with_struct.py',
      'ghidra_wasm.py'
    ];
    const candidates = [
      path.dirname(resolveEngineExe()),
      path.join(__dirname, '../engine/Il2CppDumper'),
      path.join(__dirname, '../../engine/Il2CppDumper'),
      process.resourcesPath ? path.join(process.resourcesPath, 'engine') : null,
      path.join(getAppBaseDir(), 'resources', 'engine'),
      path.join(getAppBaseDir(), 'engine'),
      path.join(process.cwd(), 'engine', 'Il2CppDumper')
    ].filter(Boolean);

    for (const s of scriptFiles) {
      const dest = path.join(targetDir, s);
      for (const c of candidates) {
        const src = path.join(c, s);
        if (fs.existsSync(src)) {
          try {
            // Copy or update script file
            fs.copyFileSync(src, dest);
            break;
          } catch {}
        }
      }
    }
  }

  // Artifacts Explorer
  app.get('/api/artifacts', (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const targetDir = req.query.dir || ws.outputDir;
    if (!fs.existsSync(targetDir)) {
      return res.json({ exists: false, artifacts: [], dummyDlls: [] });
    }

    try {
      copyScriptsToOutput(targetDir);
      const entries = fs.readdirSync(targetDir, { withFileTypes: true });
      const artifacts = [];
      let dummyDlls = [];

      for (const entry of entries) {
        const fullPath = path.join(targetDir, entry.name);
        if (entry.isFile()) {
          const stat = fs.statSync(fullPath);
          artifacts.push({
            name: entry.name,
            size: stat.size,
            path: fullPath,
            modified: stat.mtime
          });
        } else if (entry.isDirectory() && entry.name === 'DummyDll') {
          const dllFiles = fs.readdirSync(fullPath).filter(f => f.endsWith('.dll'));
          dummyDlls = dllFiles.map(dll => {
            const dllPath = path.join(fullPath, dll);
            const stat = fs.statSync(dllPath);
            return {
              name: dll,
              size: stat.size,
              path: dllPath,
              modified: stat.mtime
            };
          });
        }
      }

      res.json({
        exists: true,
        directory: targetDir,
        artifacts,
        dummyDlls,
        totalDlls: dummyDlls.length
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- DUMP.CS AST & SYMBOL ENGINE ---
  let dumpRegistryCache = null;

  function splitParameters(raw) {
    if (!raw || !raw.trim()) return [];
    const result = [];
    let depth = 0;
    let cur = '';
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === '<') depth++;
      else if (ch === '>') depth--;
      if (ch === ',' && depth === 0) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    if (cur.trim()) result.push(cur.trim());
    return result.map(p => {
      let clean = p.trim();
      let defaultValue = null;
      const eqIdx = clean.indexOf('=');
      if (eqIdx !== -1) {
        defaultValue = clean.slice(eqIdx + 1).trim();
        clean = clean.slice(0, eqIdx).trim();
      }
      const parts = clean.split(/\s+/);
      const name = parts.pop() || '';
      const type = parts.join(' ') || '';
      return { name, type, defaultValue, raw: p };
    });
  }

  async function getOrBuildDumpRegistry(dumpPath) {
    if (!fs.existsSync(dumpPath)) return null;
    const stat = fs.statSync(dumpPath);
    if (dumpRegistryCache && dumpRegistryCache.dumpPath === dumpPath && dumpRegistryCache.mtime === stat.mtimeMs) {
      return dumpRegistryCache;
    }

    const stream = fs.createReadStream(dumpPath, { encoding: 'utf8' });
    const images = [];
    let inHeader = true;
    const classes = [];
    const classByTypeDef = new Map();
    const classByName = new Map();
    const childrenByBase = new Map();
    const dllMap = new Map();

    let currentNamespace = '';
    let lineNum = 0;
    let bytePos = 0;
    let remaining = '';

    for await (const chunk of stream) {
      const lines = (remaining + chunk).split('\n');
      remaining = lines.pop();

      for (const line of lines) {
        lineNum++;
        const lineByteLength = Buffer.byteLength(line, 'utf8') + 1;

        if (inHeader) {
          const imgMatch = line.match(/^\/\/\s*Image\s+(\d+):\s+(.+?)\s+-\s+(\d+)/);
          if (imgMatch) {
            const item = { index: parseInt(imgMatch[1], 10), name: imgMatch[2], startIdx: parseInt(imgMatch[3], 10) };
            images.push(item);
            dllMap.set(item.name, []);
            bytePos += lineByteLength;
            continue;
          } else if (line.startsWith('// Namespace:')) {
            inHeader = false;
          }
        }

        if (line.startsWith('// Namespace:')) {
          currentNamespace = line.replace('// Namespace:', '').trim();
          bytePos += lineByteLength;
          continue;
        }

        const classMatch = line.match(/(public|protected|private|internal)?\s*(abstract|sealed|static)?\s*(class|struct|interface|enum)\s+([A-Za-z0-9_<>`]+)(?:\s*:\s*([^{]+))?\s*\/\/\s*TypeDefIndex:\s*(\d+)/);
        if (classMatch) {
          const typeDefIdx = parseInt(classMatch[6], 10);
          let dllName = 'Unknown';
          for (let i = images.length - 1; i >= 0; i--) {
            if (typeDefIdx >= images[i].startIdx) {
              dllName = images[i].name;
              break;
            }
          }
          const inheritance = classMatch[5] ? classMatch[5].trim().split(',').map(s => s.trim()) : [];
          const baseClass = inheritance[0] || null;
          const name = classMatch[4];
          const meta = {
            name,
            kind: classMatch[3],
            access: classMatch[1] || 'public',
            modifier: classMatch[2] || '',
            baseClass,
            interfaces: inheritance.slice(1),
            namespace: currentNamespace,
            typeDefIndex: typeDefIdx,
            dll: dllName,
            startLine: lineNum,
            byteOffset: bytePos
          };

          classes.push(meta);
          classByTypeDef.set(typeDefIdx, meta);
          if (!classByName.has(name)) classByName.set(name, []);
          classByName.get(name).push(meta);

          if (dllMap.has(dllName)) {
            dllMap.get(dllName).push(meta);
          }

          if (baseClass) {
            if (!childrenByBase.has(baseClass)) childrenByBase.set(baseClass, []);
            childrenByBase.get(baseClass).push(name);
          }
        }

        bytePos += lineByteLength;
      }
    }

    dumpRegistryCache = {
      dumpPath,
      mtime: stat.mtimeMs,
      images,
      classes,
      classByTypeDef,
      classByName,
      childrenByBase,
      dllMap
    };
    return dumpRegistryCache;
  }

  async function parseClassDetails(dumpPath, registry, typeDefIndex, targetName) {
    let targetClass = null;
    if (typeDefIndex !== undefined && typeDefIndex !== null && typeDefIndex !== '') {
      targetClass = registry.classByTypeDef.get(parseInt(typeDefIndex, 10));
    }
    if (!targetClass && targetName) {
      const list = registry.classByName.get(targetName);
      if (list && list.length > 0) targetClass = list[0];
    }
    if (!targetClass) return null;

    const readline = require('readline');
    const readStart = Math.max(0, targetClass.byteOffset - 250);
    const rl = readline.createInterface({
      input: fs.createReadStream(dumpPath, { start: readStart, encoding: 'utf8' })
    });

    const lines = [];
    let foundStart = false;

    for await (const l of rl) {
      if (!foundStart) {
        if (l.includes(`TypeDefIndex: ${targetClass.typeDefIndex}`)) {
          foundStart = true;
          lines.push(l);
        }
      } else {
        lines.push(l);
        if (lines.length > 3 && l.trim() === '}') {
          break;
        }
      }
    }
    rl.close();

    const fields = [];
    const methods = [];
    const properties = [];
    let currentSection = '';
    let lastRva = null;

    for (const l of lines) {
      const trimmed = l.trim();
      if (trimmed === '// Fields') { currentSection = 'fields'; continue; }
      if (trimmed === '// Methods') { currentSection = 'methods'; continue; }
      if (trimmed === '// Properties') { currentSection = 'properties'; continue; }

      if (trimmed.startsWith('// RVA:')) {
        const m = trimmed.match(/RVA:\s*0x([0-9A-Fa-f]+)\s+Offset:\s*0x([0-9A-Fa-f]+)\s+VA:\s*0x([0-9A-Fa-f]+)(?:\s+Slot:\s*(\d+))?/);
        if (m) lastRva = { rva: '0x' + m[1], offset: '0x' + m[2], va: '0x' + m[3], slot: m[4] || null };
        continue;
      }

      if (currentSection === 'fields' && trimmed.includes(';') && !trimmed.startsWith('[')) {
        const fieldMatch = trimmed.match(/(public|protected|private|internal)?\s*(static|readonly|const)?\s*([A-Za-z0-9_<>`\[\],\s]+?)\s+([A-Za-z0-9_]+);\s*(?:\/\/\s*(0x[0-9A-Fa-f]+))?/);
        if (fieldMatch) {
          fields.push({
            access: fieldMatch[1] || 'private',
            modifier: fieldMatch[2] || '',
            type: fieldMatch[3].trim(),
            name: fieldMatch[4].trim(),
            offset: fieldMatch[5] || null,
            raw: trimmed
          });
        }
        continue;
      }

      if (currentSection === 'methods' && ((trimmed.includes('(') && trimmed.includes('{')) || trimmed.includes(');'))) {
        const methodMatch = trimmed.match(/(public|protected|private|internal)?\s*(virtual|override|abstract|static)?\s*([A-Za-z0-9_<>`\[\],\s]+?)\s+([A-Za-z0-9_<>`\.]+)\((.*?)\)/);
        if (methodMatch) {
          const rawParams = methodMatch[5].trim();
          const params = splitParameters(rawParams);
          methods.push({
            access: methodMatch[1] || 'private',
            modifier: methodMatch[2] || '',
            returnType: methodMatch[3].trim(),
            name: methodMatch[4].trim(),
            parameters: params,
            paramCount: params.length,
            rva: lastRva?.rva || null,
            offset: lastRva?.offset || null,
            slot: lastRva?.slot || null,
            raw: trimmed
          });
        }
        lastRva = null;
        continue;
      }

      if (currentSection === 'properties' && (trimmed.includes('{ get') || trimmed.includes('{ set'))) {
        properties.push({ raw: trimmed });
      }
    }

    const childClasses = registry.childrenByBase.get(targetClass.name) || [];

    return {
      meta: {
        ...targetClass,
        childClasses,
        childCount: childClasses.length
      },
      fields,
      methods,
      properties,
      sourceCode: lines.join('\n')
    };
  }

  async function searchDumpSymbols(dumpPath, registry, query, symbolTypeFilter = 'all', limit = 40) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: fs.createReadStream(dumpPath, { encoding: 'utf8' }) });
    const qLower = query.toLowerCase();

    let currentNamespace = '';
    let currentClass = null;
    let lastRva = null;
    let lineNum = 0;
    const results = [];

    for await (const line of rl) {
      lineNum++;
      if (line.startsWith('// Namespace:')) {
        currentNamespace = line.replace('// Namespace:', '').trim();
        continue;
      }

      const classMatch = line.match(/(public|protected|private|internal)?\s*(abstract|sealed|static)?\s*(class|struct|interface|enum)\s+([A-Za-z0-9_<>`]+)(?:\s*:\s*([^{]+))?\s*\/\/\s*TypeDefIndex:\s*(\d+)/);
      if (classMatch) {
        const typeDefIdx = parseInt(classMatch[6], 10);
        currentClass = registry.classByTypeDef.get(typeDefIdx);
        if (currentClass && (symbolTypeFilter === 'all' || symbolTypeFilter === 'class')) {
          if (currentClass.name.toLowerCase().includes(qLower)) {
            const childClasses = registry.childrenByBase.get(currentClass.name) || [];
            results.push({
              symbolType: 'class',
              name: currentClass.name,
              kind: currentClass.kind,
              signature: line.trim(),
              access: currentClass.access,
              returnType: currentClass.kind,
              parameters: [],
              paramCount: 0,
              rva: null,
              offset: null,
              enclosingClass: currentClass.name,
              baseClass: currentClass.baseClass,
              childClasses,
              childCount: childClasses.length,
              interfaces: currentClass.interfaces,
              namespace: currentClass.namespace,
              dll: currentClass.dll,
              typeDefIndex: currentClass.typeDefIndex,
              line: lineNum
            });
            if (results.length >= limit) break;
          }
        }
        continue;
      }

      if (line.trim().startsWith('// RVA:')) {
        const rvaM = line.match(/RVA:\s*0x([0-9A-Fa-f]+)\s+Offset:\s*0x([0-9A-Fa-f]+)\s+VA:\s*0x([0-9A-Fa-f]+)(?:\s+Slot:\s*(\d+))?/);
        if (rvaM) {
          lastRva = {
            rva: '0x' + rvaM[1],
            offset: '0x' + rvaM[2],
            va: '0x' + rvaM[3],
            slot: rvaM[4] || null
          };
        }
        continue;
      }

      const trimmed = line.trim();
      if (trimmed.toLowerCase().includes(qLower) && currentClass) {
        // Method check
        if ((symbolTypeFilter === 'all' || symbolTypeFilter === 'method') &&
            ((trimmed.includes('(') && trimmed.includes('{')) || trimmed.includes(');'))) {
          const methodMatch = trimmed.match(/(public|protected|private|internal)?\s*(virtual|override|abstract|static)?\s*([A-Za-z0-9_<>`\[\],\s]+?)\s+([A-Za-z0-9_<>`\.]+)\((.*?)\)/);
          if (methodMatch && methodMatch[4].toLowerCase().includes(qLower)) {
            const rawParams = methodMatch[5].trim();
            const params = splitParameters(rawParams);
            const childClasses = registry.childrenByBase.get(currentClass.name) || [];

            results.push({
              symbolType: 'method',
              name: methodMatch[4].trim(),
              signature: trimmed,
              access: methodMatch[1] || 'private',
              modifier: methodMatch[2] || '',
              returnType: methodMatch[3].trim(),
              parameters: params,
              paramCount: params.length,
              rva: lastRva?.rva || null,
              offset: lastRva?.offset || null,
              va: lastRva?.va || null,
              slot: lastRva?.slot || null,
              enclosingClass: currentClass.name,
              baseClass: currentClass.baseClass,
              childClasses,
              childCount: childClasses.length,
              interfaces: currentClass.interfaces,
              namespace: currentClass.namespace,
              dll: currentClass.dll,
              typeDefIndex: currentClass.typeDefIndex,
              line: lineNum
            });
            if (results.length >= limit) break;
          }
        }
        // Field check
        else if ((symbolTypeFilter === 'all' || symbolTypeFilter === 'field') &&
                 trimmed.includes(';') && !trimmed.startsWith('[')) {
          const fieldMatch = trimmed.match(/(public|protected|private|internal)?\s*(static|readonly|const)?\s*([A-Za-z0-9_<>`\[\],\s]+?)\s+([A-Za-z0-9_]+);\s*(?:\/\/\s*(0x[0-9A-Fa-f]+))?/);
          if (fieldMatch && fieldMatch[4].toLowerCase().includes(qLower)) {
            const childClasses = registry.childrenByBase.get(currentClass.name) || [];
            results.push({
              symbolType: 'field',
              name: fieldMatch[4].trim(),
              signature: trimmed,
              access: fieldMatch[1] || 'private',
              modifier: fieldMatch[2] || '',
              fieldType: fieldMatch[3].trim(),
              returnType: fieldMatch[3].trim(),
              parameters: [],
              paramCount: 0,
              offset: fieldMatch[5] || null,
              fieldOffset: fieldMatch[5] || null,
              rva: null,
              enclosingClass: currentClass.name,
              baseClass: currentClass.baseClass,
              childClasses,
              childCount: childClasses.length,
              interfaces: currentClass.interfaces,
              namespace: currentClass.namespace,
              dll: currentClass.dll,
              typeDefIndex: currentClass.typeDefIndex,
              line: lineNum
            });
            if (results.length >= limit) break;
          }
        }
      }

      if (!line.trim().startsWith('// RVA:')) {
        lastRva = null;
      }
    }

    rl.close();
    return results;
  }

  // Enhanced Symbol Search within dump.cs
  app.get('/api/search-dump', async (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const { query, dir = ws.outputDir, limit = 40, type = 'all' } = req.query;
    if (!query || query.length < 2) {
      return res.json({ results: [], totalFound: 0 });
    }

    const dumpPath = path.join(dir, 'dump.cs');
    if (!fs.existsSync(dumpPath)) {
      return res.status(404).json({ error: 'dump.cs not found in target directory' });
    }

    try {
      const t0 = Date.now();
      const registry = await getOrBuildDumpRegistry(dumpPath);
      const results = await searchDumpSymbols(dumpPath, registry, query, type, parseInt(limit, 10));
      res.json({
        results,
        totalFound: results.length,
        tookMs: Date.now() - t0
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get all classes in a specific DLL
  app.get('/api/dll-classes', async (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const { dll, dir = ws.outputDir } = req.query;
    if (!dll) {
      return res.status(400).json({ error: 'DLL name required' });
    }

    const dumpPath = path.join(dir, 'dump.cs');
    if (!fs.existsSync(dumpPath)) {
      return res.status(404).json({ error: 'dump.cs not found' });
    }

    try {
      const registry = await getOrBuildDumpRegistry(dumpPath);
      const classes = (registry.dllMap.get(dll) || []).map(c => {
        const childClasses = registry.childrenByBase.get(c.name) || [];
        return {
          name: c.name,
          kind: c.kind,
          namespace: c.namespace,
          baseClass: c.baseClass,
          interfaces: c.interfaces,
          typeDefIndex: c.typeDefIndex,
          childCount: childClasses.length
        };
      });

      res.json({
        dll,
        totalClasses: classes.length,
        classes
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get full class details (fields, methods, code)
  app.get('/api/class-details', async (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const { typeDefIndex, name, dir = ws.outputDir } = req.query;

    const dumpPath = path.join(dir, 'dump.cs');
    if (!fs.existsSync(dumpPath)) {
      return res.status(404).json({ error: 'dump.cs not found' });
    }

    try {
      const registry = await getOrBuildDumpRegistry(dumpPath);
      const details = await parseClassDetails(dumpPath, registry, typeDefIndex, name);
      if (!details) {
        return res.status(404).json({ error: 'Class not found' });
      }
      res.json(details);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Native Windows OpenFileDialog fallback
  app.post('/api/browse-file', (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const { title = 'Select Target File', filter = 'All Files (*.*)|*.*', initialDir = '' } = req.body || {};
    let safeDir = initialDir;
    try {
      if (fs.existsSync(safeDir)) {
        const stat = fs.statSync(safeDir);
        if (!stat.isDirectory()) {
          safeDir = path.dirname(safeDir);
        }
      } else {
        safeDir = fs.existsSync(ws.workspaceDir) ? ws.workspaceDir : process.cwd();
      }
    } catch {
      safeDir = process.cwd();
    }

    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $form = New-Object System.Windows.Forms.Form
      $form.TopMost = $true
      $form.StartPosition = 'CenterScreen'
      $dialog = New-Object System.Windows.Forms.OpenFileDialog
      $dialog.Title = "${title.replace(/"/g, '`"')}"
      $dialog.Filter = "${filter.replace(/"/g, '`"')}"
      $dialog.InitialDirectory = "${safeDir.replace(/\\/g, '\\\\')}"
      $dialog.RestoreDirectory = $true
      if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $dialog.FileName
      }
      $form.Dispose()
    `;

    execFile('powershell', ['-NoProfile', '-Sta', '-Command', psScript], (err, stdout) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const selectedPath = stdout.trim();
      if (selectedPath) {
        res.json({ selectedPath });
      } else {
        res.json({ cancelled: true });
      }
    });
  });

  // Native Windows FolderBrowserDialog fallback
  app.post('/api/browse-folder', (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const { title = 'Select Directory', initialDir = '' } = req.body || {};
    let safeDir = initialDir;
    try {
      if (fs.existsSync(safeDir)) {
        const stat = fs.statSync(safeDir);
        if (!stat.isDirectory()) {
          safeDir = path.dirname(safeDir);
        }
      } else {
        safeDir = fs.existsSync(ws.outputDir) ? ws.outputDir : (fs.existsSync(ws.workspaceDir) ? ws.workspaceDir : process.cwd());
      }
    } catch {
      safeDir = process.cwd();
    }

    const psScript = `
      Add-Type -AssemblyName System.Windows.Forms
      $form = New-Object System.Windows.Forms.Form
      $form.TopMost = $true
      $form.StartPosition = 'CenterScreen'
      $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
      $dialog.Description = "${title.replace(/"/g, '`"')}"
      $dialog.SelectedPath = "${safeDir.replace(/\\/g, '\\\\')}"
      if ($dialog.ShowDialog($form) -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $dialog.SelectedPath
      }
      $form.Dispose()
    `;

    execFile('powershell', ['-NoProfile', '-Sta', '-Command', psScript], (err, stdout) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      const selectedPath = stdout.trim();
      if (selectedPath) {
        res.json({ selectedPath });
      } else {
        res.json({ cancelled: true });
      }
    });
  });

  // Open Output Directory in Windows Explorer
  app.post('/api/open-folder', (req, res) => {
    const ws = resolveWorkspaceDefaults();
    let targetDir = (req.body.dir || ws.outputDir).trim().replace(/^"|"$/g, '');
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const normalizedPath = path.normalize(targetDir);

      exec(`explorer.exe "${normalizedPath}"`, (err) => {
        if (err && err.code !== 1) {
          console.warn('explorer warning:', err.message);
        }
      });

      execFile('powershell', ['-NoProfile', '-Command', `Invoke-Item -LiteralPath '${normalizedPath.replace(/'/g, "''")}'`], () => {});

      res.json({ success: true, path: normalizedPath });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // --- METADATA HEADER SCANNER & FIXER ---
  app.get('/api/fix-metadata/defaults', (req, res) => {
    const ws = resolveWorkspaceDefaults();
    
    // Candidates for metadata
    const metaCandidates = [
      'c:\\Users\\hung\\Desktop\\REATEST\\analysis-output\\decompiled\\payload\\device-unpack\\176857764\\Managed\\Metadata\\global-metadata.dat',
      ws.metadataPath,
      path.join(ws.workspaceDir, 'global-metadata.dat'),
      path.join(ws.workspaceDir, 'input', 'global-metadata.dat')
    ];
    let defaultMeta = metaCandidates.find(p => p && fs.existsSync(p)) || metaCandidates[0];

    // Candidates for memory dump (.bin or .dat)
    let defaultDump = path.join(ws.workspaceDir, 'com.garena.game.kgvn-memory.bin');
    if (!fs.existsSync(defaultDump)) {
      try {
        const files = fs.readdirSync(ws.workspaceDir);
        const found = files.find(f => (f.endsWith('.bin') || f.endsWith('.dat')) && f !== 'global-metadata.dat');
        if (found) defaultDump = path.join(ws.workspaceDir, found);
      } catch {}
    }

    // Default output path
    const defaultOutput = defaultMeta
      ? path.join(path.dirname(defaultMeta), 'global-metadata-fixed.dat')
      : path.join(ws.workspaceDir, 'global-metadata-fixed.dat');

    res.json({
      metadataPath: defaultMeta,
      metadataExists: fs.existsSync(defaultMeta),
      dumpPath: defaultDump,
      dumpExists: fs.existsSync(defaultDump),
      outputPath: defaultOutput
    });
  });

  app.post('/api/fix-metadata/scan', (req, res) => {
    const { dumpPath, searchMode = 'auto' } = req.body;
    if (!dumpPath || !fs.existsSync(dumpPath)) {
      return res.status(400).json({ error: `File not found: ${dumpPath}` });
    }

    try {
      const data = fs.readFileSync(dumpPath);
      const candidates = [];
      const magics = [
        { magic: Buffer.from([0xaf, 0x1b, 0xb1, 0xea]), name: 'Tencent EA (0xEAB11BAF)', isEa: true },
        { magic: Buffer.from([0xaf, 0x1b, 0xb1, 0xfa]), name: 'Standard Unity FA (0xFAB11BAF)', isEa: false }
      ];

      for (const m of magics) {
        let pos = 0;
        while (pos <= data.length - 256) {
          pos = data.indexOf(m.magic, pos);
          if (pos === -1 || pos > data.length - 256) break;

          const version = data.readInt32LE(pos + 4);
          if (version >= 16 && version <= 31) {
            let headerSize = 256;
            if (version === 24) headerSize = 272;
            else if (version > 24 && version < 27) headerSize = 264;
            else if (version >= 27) headerSize = 256;

            const stringLiteralOffset = data.readUInt32LE(pos + 8);
            const stringLiteralSize = data.readInt32LE(pos + 12);
            const stringLiteralDataOffset = data.readUInt32LE(pos + 16);
            const stringLiteralDataSize = data.readInt32LE(pos + 20);
            const stringOffset = data.readUInt32LE(pos + 24);
            const stringSize = data.readInt32LE(pos + 28);
            const eventsOffset = data.readUInt32LE(pos + 32);
            const propertiesOffset = data.readUInt32LE(pos + 40);
            const methodsOffset = data.readUInt32LE(pos + 48);

            // Sanity check
            const isValid = stringLiteralDataOffset >= 0x100 && stringOffset > 0 && stringLiteralOffset > 0;

            candidates.push({
              offset: pos,
              offsetHex: '0x' + pos.toString(16),
              magicHex: m.magic.toString('hex'),
              magicName: m.name,
              isEa: m.isEa,
              version,
              headerSize,
              stringLiteralOffset: '0x' + stringLiteralOffset.toString(16),
              stringLiteralDataOffset: '0x' + stringLiteralDataOffset.toString(16),
              stringOffset: '0x' + stringOffset.toString(16),
              stringSize,
              eventsOffset: '0x' + eventsOffset.toString(16),
              propertiesOffset: '0x' + propertiesOffset.toString(16),
              methodsOffset: '0x' + methodsOffset.toString(16),
              isValid,
              previewHex: data.slice(pos, pos + 32).toString('hex')
            });
          }
          pos += 1;
        }
      }

      // Sort: valid and matching searchMode first
      candidates.sort((a, b) => {
        if (a.isValid !== b.isValid) return b.isValid ? 1 : -1;
        if (a.version === 29 && b.version !== 29) return -1;
        if (b.version === 29 && a.version !== 29) return 1;
        return a.offset - b.offset;
      });

      res.json({
        success: true,
        totalFound: candidates.length,
        candidates,
        recommended: candidates[0] || null
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/fix-metadata/apply', (req, res) => {
    const {
      dumpPath,
      metadataPath,
      headerOffset = 0,
      headerSize = 256,
      patchEaToFa = true,
      outputPath,
      setAsActive = false
    } = req.body;

    if (!dumpPath || !fs.existsSync(dumpPath)) {
      return res.status(400).json({ error: `Memory dump file not found: ${dumpPath}` });
    }
    if (!metadataPath || !fs.existsSync(metadataPath)) {
      return res.status(400).json({ error: `Target metadata file not found: ${metadataPath}` });
    }
    if (!outputPath) {
      return res.status(400).json({ error: `Output path not specified` });
    }

    try {
      const dumpBuf = fs.readFileSync(dumpPath);
      const offsetNum = typeof headerOffset === 'string' && headerOffset.startsWith('0x')
        ? parseInt(headerOffset, 16)
        : Number(headerOffset);

      if (offsetNum + headerSize > dumpBuf.length) {
        return res.status(400).json({
          error: `Header offset (${offsetNum}) + size (${headerSize}) exceeds dump file length (${dumpBuf.length})`
        });
      }

      const header = Buffer.from(dumpBuf.slice(offsetNum, offsetNum + headerSize));

      let patched = false;
      const originalMagic = header.slice(0, 4).toString('hex');
      
      // Check if magic has EA (af1bb1ea) and user requested patch
      if (patchEaToFa) {
        if (header[0] === 0xaf && header[1] === 0x1b && header[2] === 0xb1 && header[3] === 0xea) {
          header[3] = 0xfa; // EA -> FA (0xFAB11BAF)
          patched = true;
        }
      }

      const metaBuf = fs.readFileSync(metadataPath);
      if (metaBuf.length < headerSize) {
        return res.status(400).json({ error: `Metadata file is too small (${metaBuf.length} bytes)` });
      }

      const origHeaderPreview = metaBuf.slice(0, 32).toString('hex');
      const newHeaderPreview = header.slice(0, 32).toString('hex');

      // Replace header
      header.copy(metaBuf, 0, 0, headerSize);

      const outDir = path.dirname(outputPath);
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }

      fs.writeFileSync(outputPath, metaBuf);

      if (setAsActive) {
        const ws = resolveWorkspaceDefaults();
        const activePath = path.join(ws.workspaceDir, 'global-metadata.dat');
        fs.writeFileSync(activePath, metaBuf);
      }

      res.json({
        success: true,
        outputPath,
        fileSize: metaBuf.length,
        headerOffset: offsetNum,
        headerSize,
        patched,
        originalMagic,
        finalMagic: header.slice(0, 4).toString('hex'),
        version: header.readInt32LE(4),
        origHeaderPreview,
        newHeaderPreview
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // SPA fallback
  if (fs.existsSync(distPath)) {
    app.use((req, res, next) => {
      if (req.path.startsWith('/api')) return next();
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

function startBridge(port = 3001, callback) {
  const app = createBridgeApp();
  const server = app.listen(port, () => {
    console.log(`📡 Il2CppDumper Bridge Server listening on http://localhost:${port}`);
    if (callback) callback(port, server);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, trying ${port + 1}...`);
      startBridge(port + 1, callback);
    } else {
      console.error('Server error:', err);
    }
  });
  return server;
}

if (require.main === module) {
  startBridge(3001);
}

module.exports = { createBridgeApp, startBridge, resolveEngineExe, resolveWorkspaceDefaults };
