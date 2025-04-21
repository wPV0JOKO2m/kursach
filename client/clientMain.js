const pino = require('pino');
const screenshot = require('screenshot-desktop');
const { io } = require('socket.io-client');

// --- Logger Setup ---
const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,               // enable colored output for readability
      translateTime: 'yyyy-mm-dd HH:MM:ss.l o', // include timestamp with timezone offset
      ignore: 'pid,hostname'        // omit process id and hostname from logs
    }
  }
});

// --- Constants ---
// interval between full-resolution screenshots in milliseconds
const SCREENSHOT_INTERVAL = 300;
// interval between low-resolution preview screenshots in milliseconds
const PREVIEW_INTERVAL    = 5000;
// encoding format for full screenshots
const FULL_FORMAT         = 'jpeg';
// quality setting (0–100) for full screenshots
const FULL_QUALITY        = 25;
// encoding format for preview screenshots
const PREVIEW_FORMAT      = 'png';
// quality setting (0–100) for preview screenshots
const PREVIEW_QUALITY     = 30;
// interval for sending heartbeat events to server in milliseconds
const HEARTBEAT_INTERVAL  = 5000;
// name of the heartbeat event sent over socket
const HEARTBEAT_EVENT     = 'heartbeat';

// options for socket.io client connection
const SOCKET_OPTIONS = {
  transports: ['polling', 'websocket'], // fallback transports for reliability
  pingInterval: 10000,                  // how often to send ping packets
  pingTimeout: 20000,                   // time to wait for a ping response
  reconnection: true,                   // enable automatic reconnection
  reconnectionAttempts: Infinity,       // keep trying to reconnect indefinitely
  reconnectionDelay: 2000               // wait this long between reconnection attempts
};

let socket;
let currentMonitor = 0;                  // index of the monitor currently being captured
let availableDisplays = [];              // list of detected displays
let status = { connected: false, monitor: 0 }; // client connection and monitor status

/**
 * retrieves the current connection status and monitor index
 * @returns {{connected: boolean, monitor: number}} current status object
 */
function getStatus() {
  logger.debug('getStatus called', status);
  return status;
}

/**
 * starts the screenshot streaming client
 * @param {Object} options
 * @param {string} options.ip - server IP address
 * @param {number|string} options.port - server port
 * @param {string} options.nickname - username for registration
 */
function startClient({ ip, port, nickname }) {
  const SERVER_URL = `http://${ip}:${port}`;
  logger.info({ server: SERVER_URL, nickname }, 'starting client');
  connectSocket(SERVER_URL, nickname);
}

/**
 * establishes socket connection and sets up event handlers
 * @param {string} serverUrl - URL of the socket server
 * @param {string} nickname - username for registration event
 */
function connectSocket(serverUrl, nickname) {
  socket = io(serverUrl, SOCKET_OPTIONS);

  /**
   * performs initial handshake: registers user and sends display list
   */
  async function handshake() {
    try {
      socket.emit('register', { username: nickname });
      availableDisplays = await screenshot.listDisplays();
      logger.info({ count: availableDisplays.length }, 'found displays');
      socket.emit('displays', { displays: availableDisplays });
    } catch (err) {
      logger.error({ err }, 'handshake failed');
    }
  }

  socket.on('connect', () => {
    status.connected = true;
    status.monitor = currentMonitor;
    logger.info({ socketId: socket.id }, 'socket connected');
    handshake();

    // send heartbeat at regular intervals to keep connection alive
    setInterval(() => {
      if (socket.connected) {
        logger.debug('sending heartbeat');
        socket.volatile.emit(HEARTBEAT_EVENT);
      }
    }, HEARTBEAT_INTERVAL);

    beginStreaming();
  });

  socket.on('request-register', () => {
    logger.warn('server requested re-register');
    handshake();
  });

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
 * begins capturing and streaming screenshots at defined intervals
 */
function beginStreaming() {
  // stream full-resolution screenshots
  setInterval(() => {
    if (!socket.connected) return;
    screenshot({ screen: currentMonitor, format: FULL_FORMAT, quality: FULL_QUALITY })
      .then(buf => {
        logger.debug({ monitor: currentMonitor, size: buf.length }, 'captured full screenshot');
        socket.volatile.emit('full-stream', { image: buf, monitor: currentMonitor });
      })
      .catch(err => logger.error({ err }, 'error capturing full screenshot'));
  }, SCREENSHOT_INTERVAL);

  // stream low-resolution preview screenshots
  setInterval(() => {
    if (!socket.connected) return;
    screenshot({ format: PREVIEW_FORMAT, quality: PREVIEW_QUALITY })
      .then(buf => {
        logger.debug({ size: buf.length }, 'captured preview screenshot');
        socket.volatile.emit('preview-stream', { image: buf });
      })
      .catch(err => logger.error({ err }, 'error capturing preview screenshot'));
  }, PREVIEW_INTERVAL);
}

module.exports = { startClient, getStatus };
