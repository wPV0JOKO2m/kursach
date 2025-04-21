/**
 *
 * initializes the Electron renderer process UI for the screen client,
 * manages the BrowserWindow, system tray icon, and IPC event handlers
 */

const path = require('path');
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const { startClient, getStatus } = require('./clientMain');

// --- Constants ---
const ICON_PATH = path.join(__dirname, 'icon.png');  // tray icon asset
const PRELOAD_PATH = path.join(__dirname, 'preload.js');  // preload script
const INDEX_HTML = 'index.html';  // UI entry point

// browser window creation options
const WINDOW_OPTIONS = {
  frame: false,
  transparent: true,
  resizable: false,
  useContentSize: true,
  autoHideMenuBar: true,
  webPreferences: { preload: PRELOAD_PATH }
};

// system tray configuration
const TRAY_TOOLTIP = 'screen client';
const TRAY_MENU_TEMPLATE = [
  {
    label: 'Show/Hide',
    click: () => {
      // toggle visibility of main window
      mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show();
    }
  },
  { type: 'separator' },
  { label: 'Quit', click: () => app.quit() }
];

// --- Globals ---
let mainWindow = null;
let tray = null;

/**
 * create and configure the main BrowserWindow
 */
function createMainWindow() {
  mainWindow = new BrowserWindow(WINDOW_OPTIONS);
  mainWindow.loadFile(INDEX_HTML);
  
  // clear reference on close
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * initialize the system tray icon and menu
 */
function createTray() {
  if (tray) return;
  const icon = nativeImage.createFromPath(ICON_PATH);
  tray = new Tray(icon);
  tray.setToolTip(TRAY_TOOLTIP);
  tray.setContextMenu(Menu.buildFromTemplate(TRAY_MENU_TEMPLATE));
}

// --- IPC Event Handlers ---

/**
 * handle 'start-client' from renderer: kick off client and hide window
 */
ipcMain.on('start-client', (event, config) => {
  startClient(config);
  createTray();
  mainWindow.hide();
});

/**
 * handle resize requests from renderer
 * @param {{ width: number, height: number }} size - new dimensions
 */
ipcMain.on('resize-window', (event, { width, height }) => {
  if (mainWindow) mainWindow.setContentSize(width, height);
});

/**
 * provide client status to renderer
 * @returns {Promise<Object>} status info
 */
ipcMain.handle('get-status', () => getStatus());

/**
 * quit the application
 */
ipcMain.on('quit-app', () => {
  app.quit();
});

// --- Application Lifecycle ---

// ready: create main window
app.whenReady().then(createMainWindow);

// prevent app exit when all windows closed (tray will manage life cycle)
app.on('window-all-closed', event => event.preventDefault());
