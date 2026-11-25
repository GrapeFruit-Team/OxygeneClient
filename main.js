const { app, BrowserWindow, ipcMain, shell, dialog, net } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const electronLog = require('electron-log');

let autoUpdater;
try {
  const updater = require('electron-updater');
  autoUpdater = updater.autoUpdater;
} catch (e) {
  autoUpdater = null;
}

const clientId = ' ';
RPC.register(clientId);

app.userAgentFallback =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

app.commandLine.appendSwitch('disable-blink-features', 'AutomationControlled');

let rpc;
let startTimestamp = new Date();
let mainWindow;

function pingOnce() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), 5000);
    const request = net.request({
      method: 'GET',
      url: 'https://oxygene.grfruit.ru/favicon.ico',
    });
    request.on('response', (res) => {
      clearTimeout(timeout);
      resolve(res.statusCode < 500);
    });
    request.on('error', () => {
      clearTimeout(timeout);
      resolve(false);
    });
    request.end();
  });
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 770,
    minWidth: 400,
    minHeight: 515,
    icon: path.join(__dirname, 'img', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      partition: 'persist:main',
      webSecurity: true,
    },
    show: false,
  });

  mainWindow.setMenu(null);

  mainWindow.webContents.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  );

  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    if (permission === 'notifications' && url.startsWith('https://oxygene.grfruit.ru')) {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key.toLowerCase() === 'r' && input.control) {
      event.preventDefault();
      mainWindow.reload();
    }
    // if (input.key === 'F12') {
    //   event.preventDefault();
    //   if (mainWindow.webContents.isDevToolsOpened()) {
    //     mainWindow.webContents.closeDevTools();
    //   } else {
    //     mainWindow.webContents.openDevTools();
    //   }
    // }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  setupNavigationProtection('oxygene.grfruit.ru');

  const online = await pingOnce();
  if (online) {
    mainWindow.loadURL('https://oxygene.grfruit.ru/clientapp/auth.html', {
      extraHeaders: 'X-From-Electron: true',
    });
  } else {
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  }

  setupDiscordRPC();
}

function setupNavigationProtection(allowedHost) {
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const hostname = new URL(url).hostname;
      if (hostname === allowedHost) return { action: 'allow' };
      shell.openExternal(url);
      return { action: 'deny' };
    } catch {
      shell.openExternal(url);
      return { action: 'deny' };
    }
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    try {
      const hostname = new URL(url).hostname;
      if (hostname !== allowedHost) {
        event.preventDefault();
        shell.openExternal(url);
      }
    } catch {
      event.preventDefault();
      shell.openExternal(url);
    }
  });
}

function setupDiscordRPC() {
  rpc = new RPC.Client({ transport: 'ipc' });
  rpc.on('ready', () => {
    rpc.clearActivity().catch(console.error);
  });
  rpc.login({ clientId }).catch(console.error);
}

function setActivity(track, artist, isPlaying = true) {
  if (!rpc) return;
  if (!isPlaying) {
    rpc.clearActivity().catch(console.error);
    return;
  }
  rpc.setActivity({
    details: track || 'Нет трека',
    state: artist || 'Oxygène Music',
    startTimestamp,
    largeImageKey: 'music',
    largeImageText: 'Oxygène Music',
    instance: false,
  }).catch(console.error);
}

ipcMain.on('track-changed', (event, { title, artist, isPlaying }) => {
  setActivity(title, artist, isPlaying);
});

function setupAutoUpdater() {
  if (!autoUpdater) return;
  try {
    autoUpdater.logger = electronLog;
    autoUpdater.logger.transports.file.level = 'info';
    autoUpdater.autoDownload = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.fullChangelog = true;
    autoUpdater.checkForUpdates();

    autoUpdater.on('update-downloaded', (info) => {
      dialog.showMessageBox({
        type: 'info',
        title: 'Доступно обновление',
        message: `Доступно обновление ${info.version}.`,
      }).then(() => {
        setImmediate(() => autoUpdater.quitAndInstall(true, true));
      });
    });
  } catch (e) {}
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});