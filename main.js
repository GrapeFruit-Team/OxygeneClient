const { app, BrowserWindow, ipcMain, shell, dialog, net } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const electronLog = require('electron-log');

let autoUpdater;
try {
  const updater = require('electron-updater');
  autoUpdater = updater.autoUpdater;
} catch (e) {
  console.warn('electron-updater не найден, автообновление отключено');
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
    const timeout = setTimeout(() => resolve(false), 8000);
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

async function isOnline(retries = 2) {
  for (let i = 0; i <= retries; i++) {
    const ok = await pingOnce();
    if (ok) return true;
    if (i < retries) await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1340,
    height: 770,
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
    if (input.key === 'F12') {
      event.preventDefault();
      if (mainWindow.webContents.isDevToolsOpened()) {
        mainWindow.webContents.closeDevTools();
      } else {
        mainWindow.webContents.openDevTools();
      }
    }
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.loadFile(path.join(__dirname, 'offline.html'));

  setTimeout(async () => {
    const online = await isOnline();
    loadPage(online);
  }, 500);

  setupDiscordRPC();
}

async function loadPage(online) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  const currentURL = mainWindow.webContents.getURL();

  if (online && currentURL.includes('oxygene.grfruit.ru')) return;
  if (!online && currentURL.endsWith('offline.html')) return;

  if (online) {
    try {
      await mainWindow.loadURL('https://oxygene.grfruit.ru/clientapp/auth.html', {
        extraHeaders: 'X-From-Electron: true',
      });
      setupNavigationProtection('oxygene.grfruit.ru');
    } catch (error) {
      console.error('Error loading site:', error);
    }
  } else {
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  }
}

function startNetworkWatcher() {
  let consecutiveFails = 0;
  setInterval(async () => {
    const online = await isOnline();
    if (!online) {
      consecutiveFails++;
      if (consecutiveFails >= 3) loadPage(false);
    } else {
      consecutiveFails = 0;
      loadPage(true);
    }
  }, 30000);
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
    console.log('Discord RPC ready!');
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
    electronLog.info('Checking for update...');
    autoUpdater.autoDownload = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.disableWebInstaller = true;
    autoUpdater.fullChangelog = true;
    autoUpdater.checkForUpdates();

    autoUpdater.on('checking-for-update', () => electronLog.info('Checking for update...'));
    autoUpdater.on('update-available', (info) => electronLog.info('Update available:', info.version));
    autoUpdater.on('update-not-available', () => electronLog.info('No updates available'));
    autoUpdater.on('error', (err) => {
      electronLog.error('Update error:', err);
      console.error('Update error:', err);
    });
    autoUpdater.on('download-progress', (progress) => {
      electronLog.info(`Download progress: ${Math.round(progress.percent)}%`);
    });
    autoUpdater.on('update-downloaded', (info) => {
      electronLog.info('Update downloaded, installing...');
      dialog.showMessageBox({
        type: 'info',
        title: 'Доступно обновление',
        message: `Доступно обновление ${info.version}.`,
      }).then(() => {
        setImmediate(() => autoUpdater.quitAndInstall(true, true));
      });
    });
  } catch (e) {
    console.error('Ошибка инициализации автообновления:', e);
  }
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();
  startNetworkWatcher();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('web-contents-created', (event, contents) => {
  contents.on('did-fail-load', async (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
    console.error(`Error loading: ${validatedURL}:`, errorDescription);

    if (!isMainFrame) return;
    if (errorCode === -3) return;
    if (!validatedURL.includes('oxygene.grfruit.ru')) return;

    setTimeout(async () => {
      if (!(await isOnline()) && mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadFile(path.join(__dirname, 'offline.html'));
      }
    }, 2000);
  });
});
