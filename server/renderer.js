// simple logger implementation using styled console methods
const logger = {
  info: (...args) => console.info('%c[INFO]', 'color:#4CAF50;font-weight:bold;', ...args),
  warn: (...args) => console.warn('%c[WARN]', 'color:#FFC107;font-weight:bold;', ...args),
  error: (...args) => console.error('%c[ERROR]', 'color:#F44336;font-weight:bold;', ...args),
  debug: (...args) => console.debug('%c[DEBUG]', 'color:#9C27B0;font-weight:bold;', ...args),
  log: (...args) => console.log('%c[LOG]', 'color:#2196F3;', ...args)
};

const SERVER_URL = 'http://localhost:3000';
logger.info('connecting to server at', SERVER_URL);

const socket = io(SERVER_URL);

// application state kept across resets
let users = {};
let selectedUserId = null;

// —————— SOCKET EVENTS ——————

socket.on('connect', () => {
  logger.info('socket connected', socket.id);
  // request full user list on initial connection
  socket.emit('get-users');
});

socket.on('disconnect', reason => {
  logger.warn('socket disconnected:', reason);
});

/**
 * handles incoming full user list snapshot
 * @param {Array} list - array of user data objects
 */
socket.on('user-list', list => {
  logger.info('event: user-list', list);
  // merge each user into local state
  list.forEach(data => {
    const { id, username, displays = [] } = data;
    if (!users[id]) {
      users[id] = { username, displays, previewUrl: null, fullStreamUrl: null };
    } else {
      users[id].username = username;
      users[id].displays = displays;
    }
  });
  // re-render UI from updated state
  renderAllUsersUI();
});

/**
 * handles a single user registration or update
 * @param {Object} data - user data object
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
 * handles user disconnection cleanup
 * @param {Object} payload
 * @param {string} payload.id - id of disconnected user
 */
socket.on('user-disconnected', ({ id }) => {
  logger.warn('event: user-disconnected', id);
  removeUserFromList(id);
  // revoke blob URLs to free memory
  if (users[id]?.previewUrl) URL.revokeObjectURL(users[id].previewUrl);
  if (users[id]?.fullStreamUrl) URL.revokeObjectURL(users[id].fullStreamUrl);
  delete users[id];
});

/**
 * updates preview image for a user
 * @param {{id: string, image: ArrayBuffer}} payload
 */
socket.on('preview-stream', ({ id, image }) => {
  if (!users[id]) return;
  if (users[id].previewUrl) URL.revokeObjectURL(users[id].previewUrl);
  const blob = new Blob([image], { type: 'image/png' });
  users[id].previewUrl = URL.createObjectURL(blob);
  updateUserPreview(id);
});

/**
 * displays full-resolution stream for selected user
 * @param {{id: string, image: ArrayBuffer}} payload
 */
socket.on('full-stream', ({ id, image }) => {
  if (selectedUserId !== id || !users[id]) return;
  if (users[id].fullStreamUrl) URL.revokeObjectURL(users[id].fullStreamUrl);
  const blob = new Blob([image], { type: 'image/jpeg' });
  users[id].fullStreamUrl = URL.createObjectURL(blob);
  const img = document.getElementById('stream');
  img.src = users[id].fullStreamUrl;
  document.getElementById('loading').style.display = 'none';
});

// —————— RENDER HELPERS ——————

/**
 * re-renders UI for all users from state
 */
function renderAllUsersUI() {
  clearUIOnly();
  Object.keys(users).forEach(id => addUserToList(id));
}

/**
 * clears only the DOM elements (not state) and resets stream view
 */
function clearUIOnly() {
  selectedUserId = null;
  document.getElementById('user-panel').innerHTML = '';
  const streamEl = document.getElementById('stream');
  streamEl.src = '';
  document.getElementById('stream-container').classList.remove('active');
  document.getElementById('stream').style.display = 'none';
}

/**
 * adds or updates a single user entry in the UI
 * @param {string} id - user id
 */
function addUserToList(id) {
  const { username, displays, previewUrl } = users[id];
  console.log(users[id]);
  const panel = document.getElementById('user-panel');

  // remove existing entry to re-insert fresh
  const existing = document.getElementById('user-' + id);
  if (existing) existing.remove();

  const item = document.createElement('div');
  item.className = 'user-item';
  item.id = 'user-' + id;

  const nameEl = document.createElement('div');
  nameEl.className = 'user-name';
  nameEl.textContent = username;

  const preview = document.createElement('img');
  preview.className = 'user-preview';
  if (previewUrl) preview.src = previewUrl;

  item.append(nameEl, preview);

  // add monitor selector if multiple displays
  if (Array.isArray(displays) && displays.length > 1) {
    const sel = document.createElement('select');
    sel.className = 'monitor-selector';
    displays.forEach((_, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = 'monitor ' + (i + 1);
      sel.append(opt);
    });
    item.append(sel);
  }

  const fsBtn = document.createElement('button');
  fsBtn.className = 'full-screen-button';
  fsBtn.textContent = 'full screen';
  fsBtn.addEventListener('click', () => openFullScreen(id));
  item.append(fsBtn);

  panel.append(item);
}

/**
 * updates only the preview <img> src for a given user
 * @param {string} id - user id
 */
function updateUserPreview(id) {
  const item = document.getElementById('user-' + id);
  if (!item) return;
  const img = item.querySelector('.user-preview');
  img.src = users[id].previewUrl;
}

/**
 * removes a user entry from the UI
 * @param {string} id - user id
 */
function removeUserFromList(id) {
  const el = document.getElementById('user-' + id);
  if (el) el.remove();
  if (selectedUserId === id) {
    document.getElementById('stream').src = '';
    document.getElementById('stream-container').classList.remove('active');
    selectedUserId = null;
  }
}

// —————— FULLSCREEN & DISCONNECT ——————

/**
 * opens full-screen view for a user and requests stream
 * @param {string} id - user id
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

  // add a disconnect button if not already present
  if (!item.querySelector('.disconnect-button')) {
    const dBtn = document.createElement('button');
    dBtn.className = 'disconnect-button';
    dBtn.textContent = 'disconnect';
    dBtn.addEventListener('click', () => teardownStreamFor(id, dBtn));
    item.append(dBtn);
  }
}

/**
 * tears down full-screen stream and cleans up resources
 * @param {string} id - user id
 * @param {HTMLElement} btn - button that triggered teardown
 */
function teardownStreamFor(id, btn) {
  if (selectedUserId === id) {
    document.getElementById('stream').src = '';
    document.getElementById('stream-container').classList.remove('active');
    document.getElementById('stream').style.display = 'none';
    selectedUserId = null;
  }
  if (users[id]?.fullStreamUrl) URL.revokeObjectURL(users[id].fullStreamUrl);
  if (users[id]?.previewUrl)   URL.revokeObjectURL(users[id].previewUrl);
  btn.remove();
}

// —————— RESET BUTTON & ERROR HANDLERS ——————

/**
 * resets application state and re-renders UI
 */
function resetApp() {
  logger.warn('resetting application state');
  clearUIOnly();
  renderAllUsersUI();
}

document.getElementById('reset-button')
  .addEventListener('click', resetApp);

// catch uncaught exceptions and promise rejections, then reset
window.addEventListener('error', e => {
  logger.error('uncaught exception:', e);
  resetApp();
});

window.addEventListener('unhandledrejection', e => {
  logger.error('unhandled rejection:', e.reason);
  resetApp();
});
