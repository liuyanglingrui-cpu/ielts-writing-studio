const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("writingStudio", {
  exportDocx: (payload) => ipcRenderer.invoke("document:export", payload),
  loadPractice: () => ipcRenderer.invoke("practice:load"),
  savePractice: (data) => ipcRenderer.invoke("practice:save", data),
  minimize: () => ipcRenderer.send("window:minimize"),
  maximize: () => ipcRenderer.send("window:maximize"),
  close: () => ipcRenderer.send("window:close"),
});
