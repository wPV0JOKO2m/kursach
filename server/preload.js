/**
 * exposes ipc functions for user and stream events and allows sending monitor and fullscreen commands
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  onUserRegistered: (callback) => ipcRenderer.on('user-registered', callback),
  onUserDisconnected: (callback) => ipcRenderer.on('user-disconnected', callback),
  onFullStream: (callback) => ipcRenderer.on('full-stream', callback),
  onPreview: (callback) => ipcRenderer.on('preview', callback),
  selectMonitor: (userId, monitorIndex) => ipcRenderer.send('select-monitor', { userId, monitorIndex }),
  openFullScreen: (userId) => ipcRenderer.send('open-fullscreen', { userId }),
  onInitFullScreen: (callback) => ipcRenderer.on('init-fullscreen', callback)
});
