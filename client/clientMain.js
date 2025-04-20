/**
 * clientMain.js
 *
 * handles capturing desktop screenshots, streaming preview and full-resolution images,
 * maintains heartbeat signals, and communicates with the Socket.IO server.
 */

const pino = require('pino');
const screenshot = require('screenshot-desktop');
const { io } = require('socket.io-client');

// --- Logger Setup ---
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,            // enable ANSI color
      translateTime: 'yyyy-mm-dd HH:MM:ss.l o', // human-readable timestamp
      ignore: 'pid,hostname'     // omit extraneous fields
    }
  }
});

// --- Constants ---
const SCREENSHOT_INTERVAL = 300;      // ms between full-res captures
const PREVIEW_INTERVAL    = 5000;     // ms between preview captures
const FULL_FORMAT         = 'jpeg';   // full-res image format
const FULL_QUALITY        = 25;       // jpeg quality (0-100)
const PREVIEW_FORMAT      = 'png';    // preview image format
const PREVIEW_QUALITY     = 30;       // png compression level
const HEARTBEAT_INTERVAL  = 5000;     // ms between heartbeat events
const HEARTBEAT_EVENT     = 'heartbeat';

const SOCKET_OPTIONS = {
  transports: ['polling', 'websocket'], // fallback to polling
  pingInterval: 10000,
  pingTimeout: 20000,
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 2000
};

// --- State Variables ---
let socket;
let currentMonitor = 0;               // index of selected screen
let availableDisplays = [];           // array of display identifiers
let status = { connected: false, monitor: 0 };

/**
 * retrieve current connection status and monitor index
 * @returns {{ connected: boolean, monitor: number }}
 */
function getStatus() {
  logger.debug('getStatus called', status);
  return status;
}

/**
 * initialize client connection to server
 * @param {{ ip: string, port: number|string, nickname: string }} config
 */
function startClient({ ip, port, nickname }) {
  const SERVER_URL = `http://${ip}:${port}`;
  logger.info({ server: SERVER_URL, nickname }, 'starting client');
  connectSocket(SERVER_URL, nickname);
}

/**
 * establish Socket.IO connection and set up event handlers
 * @param {string} serverUrl - full server URL
 * @param {string} nickname - user-provided name
 */
function connectSocket(serverUrl, nickname) {
  socket = io(serverUrl, SOCKET_OPTIONS);

  /**
   * perform initial handshake: register and send display list
   */
  async function handshake() {
    try {
      // register with server
      socket.emit('register', { username: nickname });
      // list available screens
      availableDisplays = await screenshot.listDisplays();
      logger.info({ count: availableDisplays.length }, 'found displays');
      socket.emit('displays', { displays: availableDisplays });
    } catch (err) {
      logger.error({ err }, 'handshake failed');
    }
  }

  // on initial connection
  socket.on('connect', () => {
    status.connected = true;
    status.monitor = currentMonitor;
    logger.info({ socketId: socket.id }, 'socket connected');
    handshake();

    // start heartbeat pings
    setInterval(() => {
      if (socket.connected) {
        logger.debug('sending heartbeat');
        socket.volatile.emit(HEARTBEAT_EVENT);
      }
    }, HEARTBEAT_INTERVAL);

    // start image streaming loops
    beginStreaming();
  });

  // re-register on reconnection
  socket.on('reconnect', attempt => {
    logger.info({ attempt }, 'reconnected, performing handshake');
    status.connected = true;
    handshake();
  });

  socket.on('disconnect', reason => {
    status.connected = false;
    logger.warn({ reason }, 'socket disconnected');
  });

  socket.on('connect_error', err => {
    logger.error({ err }, 'connect error');
  });

  socket.on('error', err => {
    logger.error({ err }, 'socket error');
  });
}

/**
 * start repeating screenshot capture and emit streams
 */
function beginStreaming() {
  // full-resolution stream
  setInterval(() => {
    if (!socket.connected) {
      logger.debug('skipping full-stream; disconnected');
      return;
    }
    screenshot({ screen: currentMonitor, format: FULL_FORMAT, quality: FULL_QUALITY })
      .then(buf => {
        logger.debug({ monitor: currentMonitor, size: buf.length }, 'captured full screenshot');
        socket.volatile.emit('full-stream', { image: buf, monitor: currentMonitor });
      })
      .catch(err => {
        logger.error({ err }, 'error capturing full screenshot');
      });
  }, SCREENSHOT_INTERVAL);

  // lower-resolution preview stream
  setInterval(() => {
    if (!socket.connected) {
      logger.debug('skipping preview-stream; disconnected');
      return;
    }
    screenshot({ format: PREVIEW_FORMAT, quality: PREVIEW_QUALITY })
      .then(buf => {
        logger.debug({ size: buf.length }, 'captured preview screenshot');
        socket.volatile.emit('preview-stream', { image: buf });
      })
      .catch(err => {
        logger.error({ err }, 'error capturing preview screenshot');
      });
  }, PREVIEW_INTERVAL);
}

// export public API
typeof module !== 'undefined' && (module.exports = { startClient, getStatus });
