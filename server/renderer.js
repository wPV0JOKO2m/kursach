/**
 * client-stream-manager.js
 *
 * manages user connections, previews, and fullscreen streams
 * via socket.io and updates the UI accordingly
 */

const logger = {
  /**
   * log informational messages
   * @param  {...any} args - data to log
   */
  info: (...args) => console.info('%c[INFO]', 'color:#4CAF50;font-weight:bold;', ...args),

  /**
   * log warning messages
   * @param  {...any} args - data to log
   */
  warn: (...args) => console.warn('%c[WARN]', 'color:#FFC107;font-weight:bold;', ...args),

  /**
   * log error messages
   * @param  {...any} args - data to log
   */
  error: (...args) => console.error('%c[ERROR]', 'color:#F44336;font-weight:bold;', ...args),

  /**
   * log debug messages
   * @param  {...any} args - data to log
   */
  debug: (...args) => console.debug('%c[DEBUG]', 'color:#9C27B0;font-weight:bold;', ...args),

  /**
   * general-purpose log
   * @param  {...any} args - data to log
   */
  log: (...args) => console.log('%c[LOG]', 'color:#2196F3;', ...args)
};

const SERVER_URL = 'http://localhost:3000';
logger.info('connecting to server at', SERVER_URL);

// initialize socket connection\const socket = io(SERVER_URL);

// application state (retained across resets)
let users = {};
let selectedUserId = null;

// —————— SOCKET EVENTS ——————

/**
 * on socket connection, request full user list
 */
socket.on('connect', () => {
  logger.info('socket connected', socket.id);
  socket.emit('get-users');
});

/**
 * log disconnection reason
 * @param {string} reason
 */
socket.on('disconnect', reason => {
  logger.warn('socket disconnected:', reason);
});

/**
 * handle full user snapshot
 * @param {Array<Object>} list - array of user data
 */
socket.on('user-list', list => {
  logger.info('event: user-list', list);
  list.forEach(data => {
    const { id, username, displays = [] } = data;
    if (!users[id]) {
      users[id] = { username, displays, previewUrl: null, fullStreamUrl: null };
    } else {
      users[id].username = username;
      users[id].displays = displays;
    }
  });
  renderAllUsersUI();
});

/**
 * add or update a single user
 * @param {Object} data
 * @param {string} data.id
 * @param {string} data.username
 * @param {Array} data.displays
 */
socket.on('user-registered', data => {
  logger.info('event: user-registered', data);
  const { id, username, displays = [] } = data;

  users[id] = {
    ...users[id],
    username,
    displays,
    previewUrl: users[id]?.previewUrl ?? null,
    fullStreamUrl: users[id]?.fullStreamUrl ?? null
  };

  addUserToList(id);
});

/**
 * remove disconnected user and cleanup resources
 * @param {{ id: string }} param0
 */
socket.on('user-disconnected', ({ id }) => {
  logger.warn('event: user-disconnected', id);
  removeUserFromList(id);

  if (users[id]?.previewUrl) URL.revokeObjectURL(users[id].previewUrl);
  if (users[id]?.fullStreamUrl) URL.revokeObjectURL(users[id].fullStreamUrl);
  delete users[id];
});

/**
 * update the preview image for a user
 * @param {{ id: string, image: Uint8Array }} param0
 */
socket.on('preview-stream', ({ id, image }) => {
  if (!users[id]) return;
  if (users[id].previewUrl) URL.revokeObjectURL(users[id].previewUrl);
  const blob = new Blob([image], { type: 'image/png' });
  users[id].previewUrl = URL.createObjectURL(blob);
  updateUserPreview(id);
});

/**
 * update the full stream image when active user matches
 * @param {{ id: string, image: Uint8Array }} param0
 */
socket.on('full-stream', ({ id, image }) => {
  if (selectedUserId !== id || !users[id]) return;
  if (users[id].fullStreamUrl) URL.revokeObjectURL(users[id].fullStreamUrl);
  const blob = new Blob([image], { type: 'image/jpeg' });
  users[id].fullStreamUrl = URL.createObjectURL(blob);

  const imgEl = document.getElementById('stream');
  imgEl.src = users[id].fullStreamUrl;
  document.getElementById('loading').style.display = 'none';
});

// —————— UI RENDER HELPERS ——————

/**
 * clear DOM and re-render all users
 */
function renderAllUsersUI() {
  clearUIOnly();
  Object.keys(users).forEach(addUserToList);
}

/**
 * clear UI elements but retain state
 */
function clearUIOnly() {
  selectedUserId = null;
  document.getElementById('user-panel').innerHTML = '';
  const streamEl = document.getElementById('stream');
  streamEl.src = '';
  document.getElementById('stream-container').classList.remove('active');
  streamEl.style.display = 'none';
}

/**
 * create or update a user card in the UI
 * @param {string} id
 */
function addUserToList(id) {
  const { username, displays, previewUrl } = users[id];
  const panel = document.getElementById('user-panel');

  const existing = document.getElementById('user-' + id);
  if (existing) existing.remove();

  const item = document.createElement('div');
  item.className = 'user-item';
  item.id = 'user-' + id;

  const nameEl = document.createElement('div');
  nameEl.className = 'user-name';
  nameEl.textContent = username;

  const previewImg = document.createElement('img');
  previewImg.className = 'user-preview';
  if (previewUrl) previewImg.src = previewUrl;

  item.append(nameEl, previewImg);

  if (Array.isArray(displays) && displays.length > 1) {
    const sel = document.createElement('select');
    sel.className = 'monitor-selector';
    displays.forEach((_, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = 'Monitor ' + (i + 1);
      sel.append(opt);
    });
    item.append(sel);
  }

  const fsBtn = document.createElement('button');
  fsBtn.className = 'full-screen-button';
  fsBtn.textContent = 'Full Screen';
  fsBtn.addEventListener('click', () => openFullScreen(id));
  item.append(fsBtn);

  panel.append(item);
}

/**
 * update only the preview image element for a user
 * @param {string} id
 */
function updateUserPreview(id) {
  const item = document.getElementById('user-' + id);
  if (!item) return;
  const imgEl = item.querySelector('.user-preview');
  imgEl.src = users[id].previewUrl;
}

/**
 * remove user card and teardown if active
 * @param {string} id
 */
function removeUserFromList(id) {
  const el = document.getElementById('user-' + id);
  if (el) el.remove();
  if (selectedUserId === id) {
    const streamEl = document.getElementById('stream');
    streamEl.src = '';
    document.getElementById('stream-container').classList.remove('active');
    selectedUserId = null;
  }
}

// —————— FULLSCREEN HANDLERS ——————

/**
 * request and display fullscreen stream for a user
 * @param {string} id
 */
function openFullScreen(id) {
  const container = document.getElementById('stream-container');
  if (container.classList.contains('active')) {
    return alert('fullscreen is already opened');
  }
  selectedUserId = id;
  const item = document.getElementById('user-' + id);
  const sel = item.querySelector('.monitor-selector');
  socket.volatile.emit('request-fullscreen', { id, monitor: sel?.value ?? null });

  container.classList.add('active');
  document.getElementById('stream').style.display = 'block';

  if (!item.querySelector('.disconnect-button')) {
    const dBtn = document.createElement('button');
    dBtn.className = 'disconnect-button';
    dBtn.textContent = 'Disconnect';
    dBtn.addEventListener('click', () => teardownStreamFor(id, dBtn));
    item.append(dBtn);
  }
}

/**
 * teardown active stream and cleanup resources
 * @param {string} id
 * @param {HTMLElement} btn - the disconnect button element
 */
function teardownStreamFor(id, btn) {
  if (selectedUserId === id) {
    const streamEl = document.getElementById('stream');
    streamEl.src = '';
    document.getElementById('stream-container').classList.remove('active');
    streamEl.style.display = 'none';
    selectedUserId = null;
  }
  if (users[id]?.fullStreamUrl) URL.revokeObjectURL(users[id].fullStreamUrl);
  if (users[id]?.previewUrl)   URL.revokeObjectURL(users[id].previewUrl);
  btn.remove();
}

// —————— RESET & ERROR HANDLERS ——————

/**
 * clear UI and re-render all users
 */
function resetApp() {
  logger.warn('resetting application state');
  clearUIOnly();
  renderAllUsersUI();
}

// attach reset button listener
document.getElementById('reset-button').addEventListener('click', resetApp);

// global error handlers
window.addEventListener('error', e => {
  logger.error('uncaught exception:', e);
  resetApp();
});

window.addEventListener('unhandledrejection', e => {
  logger.error('unhandled rejection:', e.reason);
  resetApp();
});
