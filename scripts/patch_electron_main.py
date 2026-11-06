with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\electron\main.cjs", "r", encoding="utf-8") as f:
    content = f.read()

# 1. Update webPreferences with spellcheck: false
old_webpref = """    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
    },"""

new_webpref = """    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      spellcheck: false,
    },"""

content = content.replace(old_webpref, new_webpref)

# 2. Add event listeners in createWindow: prevent web context-menu, prevent navigation on drag-drop, block Ctrl+R / F5
old_show = """  // Guarantee window is shown
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });"""

new_show = """  // Native desktop app experience hardening
  mainWindow.webContents.on('context-menu', (e) => {
    // Prevent Chromium default web context menu
    e.preventDefault();
  });

  mainWindow.webContents.on('will-navigate', (e) => {
    // Prevent navigating away when dropping files
    e.preventDefault();
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Block accidental web reload shortcuts that erase workstation state
    if (((input.control || input.meta) && input.key.toLowerCase() === 'r') || input.key === 'F5') {
      event.preventDefault();
    }
  });

  // Guarantee window is shown
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
  });"""

content = content.replace(old_show, new_show)

# 3. Add window control IPC handlers
ipc_additions = """// Window Control IPC handlers
ipcMain.handle('window:minimize', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
  return mainWindow.isMaximized();
});

ipcMain.handle('window:close', () => {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.close();
});

ipcMain.handle('window:is-maximized', () => {
  return (mainWindow && !mainWindow.isDestroyed()) ? mainWindow.isMaximized() : false;
});
"""

if "ipcMain.handle('window:minimize'" not in content:
    content = content + "\n" + ipc_additions

with open(r"c:\Users\hung\Desktop\REATEST\Il2CppDumper-AOV-GUI\electron\main.cjs", "w", encoding="utf-8") as f:
    f.write(content)

print("Updated electron/main.cjs successfully!")
