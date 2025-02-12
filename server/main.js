// импортируем необходимые модули из Electron
const { app, BrowserWindow, ipcMain } = require('electron');
//  для работы с путями файловой системы
const path = require('path');
//  для создания HTTP сервера
const http = require('http');
//  Socket.io для работы с веб-сокетами
const socketIO = require('socket.io');

let mainWindow;

const server = http.createServer();
// инициализируем Socket.io с настройками CORS
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// функция для создания основного окна приложения
function createWindow () {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      // указываем путь к preload скрипту
      preload: path.join(__dirname, 'preload.js'),
      // отключаем интеграцию с Node.js для безопасности
      nodeIntegration: false,
      // включаем изоляцию контекста для безопасности
      contextIsolation: true
    }
  });

  // загружаем файл index.html в окно
  mainWindow.loadFile('index.html');
}

// когда приложение готово, создаем окно и запускаем сервер
app.whenReady().then(() => {
  createWindow();
  // запускаем HTTP сервер на порту 3000
  server.listen(3000, () => {
    console.log('Socket.io server listening on port 3000');
  });
});

// обработчик события подключения нового клиента через Socket.io
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  // отправляем событие о подключении пользователя в рендеринг процесс
  mainWindow.webContents.send('user-connected', socket.id);

  // обработчик получения данных стрима от клиента
  socket.on('stream', (data) => {
    // data является бинарным буфером
    // отправляем данные стрима в рендеринг процесс с идентификатором пользователя
    mainWindow.webContents.send('stream-data', { id: socket.id, data });
  });

  // обработчик события отключения клиента
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    // отправляем событие об отключении пользователя в рендеринг процесс
    mainWindow.webContents.send('user-disconnected', socket.id);
  });
});

// обработчик запроса на стрим из рендеринг процесса
ipcMain.on('request-stream', (event, userId) => {
  // отправляем событие 'start-stream' конкретному клиенту по его ID
  io.to(userId).emit('start-stream');
});
