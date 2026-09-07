const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const { isNoktaServerRunning } = require('./src/desktop/server-probe');

let mainWindow;
let ownedServer = null;

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    title: 'NOKTA POS - Desktop',
    icon: path.join(__dirname, 'public/nokta-pos-icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.setMenuBarVisibility(false);
  
  try {
    const config = require('./src/config/app.config');
    if (!(await isNoktaServerRunning(config.port))) {
      console.log('Starting local server for Electron...');
      ownedServer = await require('./server.js').startServer();
    } else {
      console.log('Using the NOKTA POS server already running on this computer.');
    }
    mainWindow.loadURL(`http://localhost:${config.port}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    dialog.showErrorBox('Server Error', 'Failed to start the local server: ' + err.message);
    app.quit();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Keep packaged customer data outside the installation directory.
  if (!process.env.POS_DATA_DIR) process.env.POS_DATA_DIR = path.join(app.getPath('userData'), 'data');
  // Windows lists USB, Bluetooth, and installed network printers together.
  // Expose only this read-only inventory to the renderer.
  ipcMain.handle('nokta:printers:list', async () => {
    const window = BrowserWindow.getFocusedWindow() || mainWindow;
    if (!window) return [];
    const printers = await window.webContents.getPrintersAsync();
    return printers.map(printer => ({
      id: printer.name,
      name: printer.displayName || printer.name,
      device: printer.name,
      type: printer.isDefault ? 'default' : 'system',
      status: printer.status || 0,
      isDefault: !!printer.isDefault
    }));
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', async event => {
  if (!ownedServer) return;
  event.preventDefault();
  const server = ownedServer;
  ownedServer = null;
  try { await server.close(); } finally { app.quit(); }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
