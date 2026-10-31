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

  // Artifacts Explorer
  app.get('/api/artifacts', (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const targetDir = req.query.dir || ws.outputDir;
    if (!fs.existsSync(targetDir)) {
      return res.json({ exists: false, artifacts: [], dummyDlls: [] });
    }

    try {
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

  // Search within dump.cs
  app.get('/api/search-dump', async (req, res) => {
    const ws = resolveWorkspaceDefaults();
    const { query, dir = ws.outputDir, limit = 50 } = req.query;
    if (!query || query.length < 2) {
      return res.json({ results: [] });
    }

    const dumpPath = path.join(dir, 'dump.cs');
    if (!fs.existsSync(dumpPath)) {
      return res.status(404).json({ error: 'dump.cs not found in target directory' });
    }

    const results = [];
    const qLower = query.toLowerCase();

    const fileStream = fs.createReadStream(dumpPath, { encoding: 'utf8' });
    let buffer = '';
    let lineCount = 0;

    for await (const chunk of fileStream) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop();

      for (const line of lines) {
        lineCount++;
        if (line.toLowerCase().includes(qLower)) {
          results.push({
            line: lineCount,
            content: line.trim()
          });
          if (results.length >= parseInt(limit, 10)) {
            fileStream.destroy();
            break;
          }
        }
      }
      if (results.length >= parseInt(limit, 10)) break;
    }

    res.json({ results, totalFound: results.length });
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
