const { app, BrowserWindow, ipcMain, shell, dialog, net } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const electronLog = require('electron-log');

// Пытаемся загрузить автообновление, если доступно
let autoUpdater;
try {
  const updater = require('electron-updater');
  autoUpdater = updater.autoUpdater;
} catch (e) {
  console.warn('electron-updater не найден, автообновление отключено');
  autoUpdater = null;
}

const clientId = '1429230863614349362';
RPC.register(clientId);

let rpc;
let startTimestamp = new Date();
let mainWindow;

function isOnline() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve(false);
    }, 3000);
    const request = net.request({
      method: 'HEAD',
      url: 'https://oxygene.grfruit.ru',
    });
    request.on('response', () => {
      clearTimeout(timeout);
      resolve(true);
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

  // Автоматически разрешаем уведомления для нашего домена (чтобы не спрашивать)
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    const url = webContents.getURL();
    if (permission === 'notifications' && url.startsWith('https://oxygene.grfruit.ru')) {
      callback(true);
    } else {
      callback(false);
    }
  });

  mainWindow.webContents.on('before-input-event', (event, input) => {
    if ((input.key.toLowerCase() === 'r' && input.control)) {
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

  if (online && (!currentURL.includes('auth.html') && !currentURL.includes('oxygene.grfruit.ru'))) {
    try {
      await mainWindow.loadURL('https://oxygene.grfruit.ru/clientapp/auth.html', {
        extraHeaders: 'X-From-Electron: true',
      });
      setupNavigationProtection('oxygene.grfruit.ru');
    } catch (error) {
      console.error('Error loading site:', error);
    }
  } else if (!online && !currentURL.endsWith('offline.html')) {
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
  }
}

function startNetworkWatcher() {
  setInterval(async () => {
    const online = await isOnline();
    loadPage(online);
  }, 15000);
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
  contents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`Error loading: ${validatedURL}:`, errorDescription);
    if (validatedURL.includes('oxygene.grfruit.ru') && mainWindow && !mainWindow.isDestroyed()) {
      setTimeout(async () => {
        if (!(await isOnline())) {
          mainWindow.loadFile(path.join(__dirname, 'offline.html'));
        }
      }, 1000);
    }
  });
});