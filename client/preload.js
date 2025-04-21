/**
 *
 * securely exposes IPC methods to the renderer process via Electron's contextBridge
 * for starting the client, resizing the window, querying status, and quitting the app.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  startClient: (cfg) => ipcRenderer.send('start-client', cfg),
  resizeWindow: (size) => ipcRenderer.send('resize-window', size),
  getStatus: () => ipcRenderer.invoke('get-status'),
  quitApp: () => ipcRenderer.send('quit-app')
});
