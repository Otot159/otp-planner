const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('pomo', {
  close: () => ipcRenderer.send('pomo-close'),
  moveWindow: (dx, dy) => ipcRenderer.send('pomo-window-move', dx, dy),
});
