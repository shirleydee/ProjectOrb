// // preload.js
// const { contextBridge, ipcRenderer } = require("electron");

// contextBridge.exposeInMainWorld("orb", {
//   // Tabs
//   createTab: (url) => ipcRenderer.invoke("tabs:create", url),
//   switchTab: (id) => ipcRenderer.invoke("tabs:switch", id),
//   closeTab: (id) => ipcRenderer.invoke("tabs:close", id),
//   navigateTab: (id, url) => ipcRenderer.invoke("tabs:navigate", { id, url }),
//   reloadTab: (id) => ipcRenderer.invoke("tabs:reload", id),
//   listTabs: () => ipcRenderer.invoke("tabs:list"),

//   // Subscribe to tab updates
//   onTabsUpdate: (cb) => {
//     const handler = (_, data) => cb(data);
//     ipcRenderer.on("tabs:update", handler);
//     return () => ipcRenderer.off("tabs:update", handler);
//   },

//   // Overlay events from BrowserView
//   onOverlayShow: (cb) => {
//     const handler = (_, data) => cb(data);
//     ipcRenderer.on("overlay:show", handler);
//     return () => ipcRenderer.off("overlay:show", handler);
//   },
//   hideOverlay: () => ipcRenderer.send("overlay:hide"),
//   onOverlayHide: (cb) => {
//     const handler = () => cb();
//     ipcRenderer.on("overlay:hide", handler);
//     return () => ipcRenderer.off("overlay:hide", handler);
//   },

//   send: (channel, data) => {
//     ipcRenderer.send(channel, data);
//   },
// });



// preload.js
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("orb", {
  // Tabs
  createTab: (url) => ipcRenderer.invoke("tabs:create", url),
  switchTab: (id) => ipcRenderer.invoke("tabs:switch", id),
  closeTab: (id) => ipcRenderer.invoke("tabs:close", id),
  navigateTab: (id, url) => ipcRenderer.invoke("tabs:navigate", { id, url }),
  reloadTab: (id) => ipcRenderer.invoke("tabs:reload", id),
  listTabs: () => ipcRenderer.invoke("tabs:list"),

  // Updates
  onTabsUpdate: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("tabs:update", handler);
    return () => ipcRenderer.off("tabs:update", handler);
  },

  // Overlay
  onOverlayShow: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("overlay:show", handler);
    return () => ipcRenderer.off("overlay:show", handler);
  },
  hideOverlay: () => ipcRenderer.send("overlay:hide"),
  onOverlayHide: (cb) => {
    const handler = () => cb();
    ipcRenderer.on("overlay:hide", handler);
    return () => ipcRenderer.off("overlay:hide", handler);
  },
  onToggleChat: (callback) => ipcRenderer.on("toggle-chat", callback)
});
