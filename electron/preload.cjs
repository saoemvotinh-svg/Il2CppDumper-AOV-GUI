const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  browseFile: (options) => ipcRenderer.invoke('dialog:browse-file', options),
  browseFolder: (options) => ipcRenderer.invoke('dialog:browse-folder', options),
  openFolder: (dirPath) => ipcRenderer.invoke('shell:open-folder', dirPath),
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
});
