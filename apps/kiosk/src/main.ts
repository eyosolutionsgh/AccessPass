import { writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { app, BrowserWindow, ipcMain, Menu, session } from 'electron';
import { type BadgeData, renderBadgeHtml } from './badge.ts';
import { logger } from './logger.ts';

const WEB_URL = process.env.KIOSK_WEB_URL || 'http://localhost:5173';
const PRINTER = process.env.KIOSK_PRINTER; // system printer name; unset → render to PDF
const isDev = !app.isPackaged;

let win: BrowserWindow | null = null;

// Last-resort funnels for the main process — without these a throw here dies silently on an
// unattended kiosk (the job Sentry would do, kept on-prem with pino).
process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'kiosk main uncaught exception');
});
process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'kiosk main unhandled rejection');
});

function createWindow() {
  win = new BrowserWindow({
    kiosk: !isDev,
    fullscreen: !isDev,
    frame: isDev,
    autoHideMenuBar: true,
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload reads kiosk config from env; renderer stays isolated
    },
  });

  // Lockdown (SRS §11.5): no app menu, no new windows, no off-site navigation.
  Menu.setApplicationMenu(null);
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(WEB_URL)) event.preventDefault();
  });

  // Capture renderer failures and self-heal: a crashed/blank kiosk left unattended is useless, so
  // log the cause then reload the check-in page (skip 'clean-exit', a normal teardown).
  win.webContents.on('render-process-gone', (_event, details) => {
    logger.error({ details }, 'kiosk renderer gone');
    if (details.reason !== 'clean-exit' && win && !win.isDestroyed()) {
      void win.loadURL(`${WEB_URL}/check-in?kiosk=1`);
    }
  });
  win.webContents.on('unresponsive', () => logger.warn('kiosk renderer unresponsive'));
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    logger.error({ preloadPath, err: error }, 'kiosk preload error');
  });

  void win.loadURL(`${WEB_URL}/check-in?kiosk=1`);
}

function registerIpc() {
  /** Print (or render to PDF) a visitor badge after check-in (SRS FR-050). */
  ipcMain.handle('kiosk:print-badge', async (_event, badge: BadgeData) => {
    let printerWin: BrowserWindow | null = null;
    try {
      const html = await renderBadgeHtml(badge);
      const printer = (printerWin = new BrowserWindow({ show: false }));
      await printer.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));

      if (PRINTER) {
        await new Promise<void>((resolve, reject) =>
          printer.webContents.print(
            { silent: true, deviceName: PRINTER, margins: { marginType: 'none' } },
            (ok, err) => (ok ? resolve() : reject(new Error(err))),
          ),
        );
        return { ok: true };
      }

      // No physical printer configured → produce a verifiable PDF (dev/demo).
      const pdf = await printer.webContents.printToPDF({
        pageSize: { width: 4, height: 3 },
        printBackground: true,
      });
      const path = join(tmpdir(), `vms-badge-${badge.badgeNumber}.pdf`);
      await writeFile(path, pdf);
      return { ok: true, path };
    } catch (err) {
      logger.error({ err, badgeNumber: badge.badgeNumber }, 'kiosk badge print failed');
      throw err; // still surface to the renderer's invoke() rejection
    } finally {
      if (printerWin && !printerWin.isDestroyed()) printerWin.close();
    }
  });

  /** Clear session data between visitors so no prior data leaks (SRS §11.5). */
  ipcMain.handle('kiosk:reset', async () => {
    try {
      await session.defaultSession.clearStorageData({
        storages: ['cookies', 'localstorage', 'cachestorage'],
      });
      return { ok: true };
    } catch (err) {
      logger.error({ err }, 'kiosk reset failed');
      throw err;
    }
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // GPU/utility/network helper crashes (renderer crashes are handled per-window above).
  app.on('child-process-gone', (_event, details) => {
    logger.error({ details }, 'kiosk child process gone');
  });

  app.whenReady().then(() => {
    registerIpc();
    createWindow();
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
