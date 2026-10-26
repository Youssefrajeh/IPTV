// Desktop shell (Windows / macOS / Linux) for the IPTV web app.
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');

// Let streams start with sound without a click first
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#0b0e14',
    title: 'IPTV Player',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      // Lets the app fetch provider playlists/streams that don't send CORS headers.
      // Only local app files are loaded in this window (external links open in the browser).
      webSecurity: false,
    },
  });

  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Open any external link in the user's browser instead of inside the app
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('file://')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // F11 toggles fullscreen
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') win.setFullScreen(!win.isFullScreen());
  });

  ipcMain.on('toggle-fullscreen', () => win.setFullScreen(!win.isFullScreen()));
}

ipcMain.on('quit', () => app.quit());

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
