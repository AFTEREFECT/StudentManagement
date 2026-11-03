const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld('desktopAttendance', Object.freeze({
  claim: (key) => ipcRenderer.invoke('attendance:claim', key),
  finish: (key, token, result) => ipcRenderer.invoke('attendance:finish', key, token, result),
  archiveKey: () => ipcRenderer.invoke('attendance:archive-key'),
  signArchive: (payload) => ipcRenderer.invoke('attendance:sign-archive', payload),
}));

contextBridge.exposeInMainWorld(
  "desktopStorage",
  Object.freeze({
    readDatabase: () => ipcRenderer.invoke("database:read"),
    writeDatabase: (data) => ipcRenderer.invoke("database:write", data),
    deleteDatabase: () => ipcRenderer.invoke("database:delete"),
  })
);
