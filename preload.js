const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('noktaDesktop', {
  listPrinters: () => ipcRenderer.invoke('nokta:printers:list')
});
