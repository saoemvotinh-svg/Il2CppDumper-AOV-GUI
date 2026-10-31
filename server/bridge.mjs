import express from 'express';
import cors from 'cors';
import { spawn, execFile, exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Default paths for convenience in REATEST workspace
function resolveEngineExe() {
  if (process.resourcesPath) {
    const packaged = path.join(process.resourcesPath, 'engine', 'Il2CppDumper.exe');
    if (fs.existsSync(packaged)) return packaged;
  }
  return path.resolve('..', 'Il2CppDumper-src', 'Il2CppDumper-master', 'Il2CppDumper', 'bin', 'Release', 'net8.0', 'Il2CppDumper.exe');
}
const DEFAULT_EXE = resolveEngineExe();
const DEFAULT_ELF = path.resolve('..', 'analysis-output', 'decompiled', 'payload', 'device-unpack', '176857764', 'arm64-v8a', 'libil2cpp.so');
const DEFAULT_META = path.resolve('..', 'analysis-output', 'p5_il2cpp', 'global-metadata.repaired.dat');
const DEFAULT_OUT = path.resolve('..', 'analysis-output', 'il2cppdumper_out');

// Active SSE client connections for real-time log streaming
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
    client.write(`data: ${data}\n\n`);
  });
}

// SSE endpoint
app.get('/api/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  sseClients.push(res);

  // Send current buffer
  executionLogs.forEach(entry => {
    res.write(`data: ${JSON.stringify(entry)}\n\n`);
  });

  req.on('close', () => {
    sseClients = sseClients.filter(c => c !== res);
  });
});

// System Status
app.get('/api/status', (req, res) => {
  const exeExists = fs.existsSync(DEFAULT_EXE);
  const elfExists = fs.existsSync(DEFAULT_ELF);
  const metaExists = fs.existsSync(DEFAULT_META);

  res.json({
    isRunning,
    defaults: {
      exePath: DEFAULT_EXE,
      exeExists,
      elfPath: DEFAULT_ELF,
      elfExists,
      metadataPath: DEFAULT_META,
      metadataExists: metaExists,
      outputDir: DEFAULT_OUT,
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

  const {
    exePath = DEFAULT_EXE,
    elfPath = DEFAULT_ELF,
    metadataPath = DEFAULT_META,
    outputDir = DEFAULT_OUT,
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

  // Update config.json in Il2CppDumper working directory if options passed
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
  
  // Launch Il2CppDumper
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
  const targetDir = req.query.dir || DEFAULT_OUT;
  if (!fs.existsSync(targetDir)) {
    return res.json({ exists: false, artifacts: [], dummyDlls: [] });
  }

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
});

// Search within dump.cs
app.get('/api/search-dump', async (req, res) => {
  const { query, dir = DEFAULT_OUT, limit = 50 } = req.query;
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
    buffer = lines.pop(); // keep last incomplete line

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

// Native Windows OpenFileDialog
app.post('/api/browse-file', (req, res) => {
  const { title = 'Select Target File', filter = 'All Files (*.*)|*.*', initialDir = '' } = req.body || {};
  let safeDir = initialDir;
  try {
    if (fs.existsSync(safeDir)) {
      const stat = fs.statSync(safeDir);
      if (!stat.isDirectory()) {
        safeDir = path.dirname(safeDir);
      }
    } else {
      safeDir = fs.existsSync(DEFAULT_OUT) ? DEFAULT_OUT : process.cwd();
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
      console.error('File dialog error:', err);
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

// Native Windows FolderBrowserDialog
app.post('/api/browse-folder', (req, res) => {
  const { title = 'Select Directory', initialDir = '' } = req.body || {};
  let safeDir = initialDir;
  try {
    if (fs.existsSync(safeDir)) {
      const stat = fs.statSync(safeDir);
      if (!stat.isDirectory()) {
        safeDir = path.dirname(safeDir);
      }
    } else {
      safeDir = fs.existsSync(DEFAULT_OUT) ? DEFAULT_OUT : process.cwd();
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
      console.error('Folder dialog error:', err);
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
  let targetDir = (req.body.dir || DEFAULT_OUT).trim().replace(/^"|"$/g, '');
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const normalizedPath = path.normalize(targetDir);

    // 1. Launch explorer directly
    exec(`explorer.exe "${normalizedPath}"`, (err) => {
      if (err && err.code !== 1) {
        console.warn('explorer warning:', err.message);
      }
    });

    // 2. Also invoke via PowerShell Invoke-Item
    execFile('powershell', ['-NoProfile', '-Command', `Invoke-Item -LiteralPath '${normalizedPath.replace(/'/g, "''")}'`], () => {});

    res.json({ success: true, path: normalizedPath });
  } catch (err) {
    console.error('open-folder exception:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`📡 Il2CppDumper Bridge Server listening on http://localhost:${PORT}`);
});
