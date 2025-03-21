const { app, BrowserWindow } = require('electron');
const path = require('path');
const socketIo = require('socket.io');

const WINDOW_WIDTH = 1200;
const WINDOW_HEIGHT = 800;
const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const INDEX_HTML = 'index.html';
const SOCKET_SERVER_PORT = 3000;

let mainWindow;
const sockets = {};

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      preload: PRELOAD_PATH
    }
  });
  mainWindow.loadFile(INDEX_HTML);
}

app.whenReady().then(createWindow);

const io = socketIo(SOCKET_SERVER_PORT);

io.on('connection', (socket) => {
  sockets[socket.id] = socket;
  
  socket.on('register', (data) => {
    socket.username = data.username;
    io.emit('user-registered', { id: socket.id, username: data.username });
  });

  socket.on('displays', (data) => {
    io.emit('user-registered', { id: socket.id, displays: data.displays });
  });

  socket.on('preview-stream', (data) => {
    io.emit('preview-stream', { id: socket.id, image: data.image });
  });

  socket.on('full-stream', (data) => {
    io.emit('full-stream', { id: socket.id, image: data.image, monitor: data.monitor });
  });

  socket.on('request-fullscreen', (data) => {
    const targetSocket = sockets[data.id];
    if (targetSocket) {
      targetSocket.emit('switch-monitor', { monitor: data.monitor });
    }
  });

  socket.on('disconnect', () => {
    io.emit('user-disconnected', { id: socket.id });
    delete sockets[socket.id];
  });
});
