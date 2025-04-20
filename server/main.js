/**
 * main.js
 *
 * initializes Electron app, sets up HTTP and Socket.IO server,
 * tracks capture clients and UI sockets with heartbeat monitoring,
 * and proxies events between capture clients and UI windows.
 */

const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const socketIo = require('socket.io');
const pino = require('pino');

// configure pretty logging in development
const prettyTransport =
  process.env.NODE_ENV !== 'production'
    ? pino.transport({
        target: require.resolve('pino-pretty'),
        options: {
          colorize: true,
          translateTime: 'yyyy-mm-dd HH:MM:ss.l o',
        },
      })
    : undefined;

// instantiate logger with configurable level
const logger =
  prettyTransport
    ? pino({ level: process.env.LOG_LEVEL || 'info' }, prettyTransport)
    : pino({ level: process.env.LOG_LEVEL || 'info' });

// application constants
const WINDOW_WIDTH = 1200;
const WINDOW_HEIGHT = 800;
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const INDEX_HTML = 'index.html';
const SERVER_PORT = 3000;

// state containers
let mainWindow;
const captureClients = {};  // { socketId: { id, socket, username, displays } }
const uiSockets = {};       // { socketId: Socket }
const heartbeats = {};      // { socketId: timestamp }

// heartbeat timing
const HEARTBEAT_INTERVAL = 5000;
const HEARTBEAT_TIMEOUT = 15000;

/**
 * create and configure the main Electron BrowserWindow
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: { preload: PRELOAD_PATH },
  });
  mainWindow.loadFile(INDEX_HTML);
  logger.info('main window created', {
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    preload: PRELOAD_PATH,
  });
}

// launch when Electron is ready
app.whenReady().then(() => {
  createWindow();

  // setup HTTP server & Socket.IO
  const server = http.createServer();
  const io = socketIo(server, { pingInterval: 10000, pingTimeout: 5000 });

  /**
   * handle new Socket.IO connections (both capture clients & UI sockets)
   */
  io.on('connection', (socket) => {
    const sockLog = logger.child({ socketId: socket.id });
    sockLog.info('socket.io connection established');

    // default: treat as UI socket until 'register' as capture
    uiSockets[socket.id] = socket;

    // inform new UI socket of existing capture clients
    Object.values(captureClients).forEach((client) => {
      socket.volatile.emit('user-registered', {
        id: client.id,
        username: client.username,
        displays: client.displays,
      });
    });

    /**
     * register a capture client (screen share provider)
     */
    socket.on('register', (data) => {
      const id = socket.id;
      delete uiSockets[id];
      captureClients[id] = {
        id,
        socket,
        username: data.username,
        displays: [],
      };
      heartbeats[id] = Date.now();

      sockLog.info('capture client registered', { username: data.username });
      const payload = { id, username: data.username };

      // notify renderer and all UI sockets
      mainWindow.webContents.send('user-registered', payload);
      Object.values(uiSockets).forEach((s) => s.emit('user-registered', payload));
    });

    /**
     * update display info for a capture client
     */
    socket.on('displays', (data) => {
      const id = socket.id;
      const client = captureClients[id];
      if (!client) return;

      client.displays = data.displays;
      sockLog.info('displays updated', { displays: data.displays });

      const payload = { id, username: client.username, displays: client.displays };
      mainWindow.webContents.send('user-registered', payload);
      Object.values(uiSockets).forEach((s) => s.emit('user-registered', payload));
    });

    /**
     * forward full-screen image stream to UI
     */
    socket.on('full-stream', (data) => {
      const id = socket.id;
      if (!captureClients[id]) return;

      sockLog.trace('full stream data received');
      const payload = { id, image: data.image };
      mainWindow.webContents.send('full-stream', payload);
      Object.values(uiSockets).forEach((s) => s.emit('full-stream', payload));
    });

    /**
     * forward preview image stream to UI
     */
    socket.on('preview-stream', (data) => {
      const id = socket.id;
      if (!captureClients[id]) return;

      sockLog.trace('preview stream data received');
      const payload = { id, image: data.image };
      mainWindow.webContents.send('preview-stream', payload);
      Object.values(uiSockets).forEach((s) => s.emit('preview-stream', payload));
    });

    /**
     * receive heartbeat from capture client
     */
    socket.on('heartbeat', () => {
      const id = socket.id;
      if (heartbeats[id] !== undefined) {
        heartbeats[id] = Date.now();
        sockLog.debug('heartbeat timestamp updated');
      }
    });

    /**
     * cleanup on disconnect (capture vs UI)
     */
    socket.on('disconnect', (reason) => {
      const id = socket.id;
      if (captureClients[id]) {
        sockLog.warn('capture client disconnected', { reason });
        delete captureClients[id];
        delete heartbeats[id];

        mainWindow.webContents.send('user-disconnected', { id });
        Object.values(uiSockets).forEach((s) => s.emit('user-disconnected', { id }));
      } else if (uiSockets[id]) {
        sockLog.info('ui socket disconnected', { reason });
        delete uiSockets[id];
      }
    });
  });

  /**
   * periodically check heartbeat timeouts and disconnect stale clients
   */
  setInterval(() => {
    const now = Date.now();
    Object.entries(heartbeats).forEach(([id, last]) => {
      if (now - last > HEARTBEAT_TIMEOUT) {
        logger.warn('heartbeat timeout exceeded, disconnecting client', { clientId: id });
        const client = captureClients[id];
        if (client) client.socket.disconnect(true);

        delete captureClients[id];
        delete heartbeats[id];

        mainWindow.webContents.send('user-disconnected', { id });
        Object.values(uiSockets).forEach((s) => s.emit('user-disconnected', { id }));
      }
    });
  }, HEARTBEAT_INTERVAL);

  /**
   * start listening on specified port
   */
  server.listen(SERVER_PORT, '0.0.0.0', () => {
    logger.info('socket.io server listening', { port: SERVER_PORT });
  });
});
