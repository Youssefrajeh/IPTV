const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronApp', {
  isElectron: true,
  toggleFullscreen: () => ipcRenderer.send('toggle-fullscreen'),
  quit: () => ipcRenderer.send('quit'),
});
