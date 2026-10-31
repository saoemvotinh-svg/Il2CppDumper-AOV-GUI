const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { startBridge } = require('../server/bridge.cjs');

let mainWindow = null;
let bridgeServer = null;
let activePort = 3001;

// Global error handlers
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  dialog.showErrorBox('IL2CppDumper Studio Error', err.stack || err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
});

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'IL2CPPDUMPER WORKSTATION',
    backgroundColor: '#151719',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },
  });

  // Guarantee window is shown
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });

  // Fallback timer to show window if ready-to-show didn't fire
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 1200);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Page load failed:', errorCode, errorDescription, validatedURL);
    dialog.showErrorBox('Network / UI Error', `Failed to load workstation UI from ${validatedURL}\n\n${errorDescription} (Code: ${errorCode})`);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Load via bridge HTTP server
  const targetUrl = `http://localhost:${port}`;
  console.log(`Connecting UI window to ${targetUrl}`);
  mainWindow.loadURL(targetUrl);
}

// Native IPC handlers
ipcMain.handle('dialog:browse-file', async (_event, options = {}) => {
  const { title = 'Select File', filter = [] } = options;
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ['openFile'],
    filters: filter.length > 0 ? filter : [
      { name: 'Supported Files', extensions: ['so', 'dat', 'dll', 'exe'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { selectedPath: result.filePaths[0] };
  }
  return { cancelled: true };
});

ipcMain.handle('dialog:browse-folder', async (_event, options = {}) => {
  const { title = 'Select Directory' } = options;
  const result = await dialog.showOpenDialog(mainWindow, {
    title,
    properties: ['openDirectory']
  });
  if (!result.canceled && result.filePaths.length > 0) {
    return { selectedPath: result.filePaths[0] };
  }
  return { cancelled: true };
});

ipcMain.handle('shell:open-folder', async (_event, dirPath) => {
  if (!dirPath) return { success: false, error: 'No path specified' };
  try {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
    await shell.openPath(path.normalize(dirPath));
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// App Lifecycle
app.whenReady().then(() => {
  // Start bridge server
  bridgeServer = startBridge(3001, (port) => {
    activePort = port;
    createWindow(activePort);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow(activePort);
    }
  });
});

app.on('window-all-closed', () => {
  if (bridgeServer) {
    bridgeServer.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
