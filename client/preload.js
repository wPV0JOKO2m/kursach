/**
 * preload.js
 *
 * securely exposes IPC methods to the renderer process via Electron's contextBridge
 * for starting the client, resizing the window, querying status, and quitting the app.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  /**
   * send a request to start the client with given configuration
   * @param {{ ip: string, port: number|string, nickname: string }} cfg - connection settings
   */
  startClient: (cfg) => ipcRenderer.send('start-client', cfg),

  /**
   * request the main process to resize the application window
   * @param {{ width: number, height: number }} size - new window dimensions
   */
  resizeWindow: (size) => ipcRenderer.send('resize-window', size),

  /**
   * retrieve current client connection status from the main process
   * @returns {Promise<Object>} promise resolving with status information
   */
  getStatus: () => ipcRenderer.invoke('get-status'),

  /**
   * instruct the main process to terminate the application
   */
  quitApp: () => ipcRenderer.send('quit-app')
});
