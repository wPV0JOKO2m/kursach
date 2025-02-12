// импортируем необходимые модули из Electron
const { contextBridge, ipcRenderer } = require('electron');

// используем contextBridge для безопасного экспонирования API в окне рендеринга
contextBridge.exposeInMainWorld('electronAPI', {
  // листенер события подключения пользователя
  onUserConnected: (callback) => ipcRenderer.on('user-connected', callback),
  
  // листенер события отключения пользователя
  onUserDisconnected: (callback) => ipcRenderer.on('user-disconnected', callback),
  
  // листенер события получения данных стрима
  onStreamData: (callback) => ipcRenderer.on('stream-data', callback),
  
  // функция для запроса стрима от конкретного пользователя
  requestStream: (userId) => ipcRenderer.send('request-stream', userId)
});
