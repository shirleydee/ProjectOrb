// main.js
const { app, BrowserWindow, BrowserView, ipcMain, Menu } = require("electron");
const path = require("path");

let mainWindow;
/** @type {Record<string, {id:string,url:string,title?:string,view:BrowserView}>} */
const tabs = {};
let activeTabId = null;
let nextTabId = 1;

const TAB_BAR_HEIGHT = 40; // must match your TabShell’s header height

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1300,
    height: 900,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const startUrl = process.env.ELECTRON_START_URL || "http://localhost:3000";
  mainWindow.loadURL(startUrl);

  mainWindow.on("resize", () => layoutActiveView());

  // ✅ Set up global application menu here
  const template = [
    {
      label: "File",
      submenu: [{ role: "quit" }]
    },
    {
      label: "Tools",
      submenu: [
        {
          label: "Quick Chat",
          click: () => {
            mainWindow.webContents.send("toggle-chat");
          }
        },
        {
          label: "Live Mode",
          click: () => {
            mainWindow.webContents.send("toggle-live-mode", true);
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) app.whenReady().then(() => {
    mainWindow = new BrowserWindow({
      width: 1300,
      height: 900,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });
    mainWindow.loadURL(process.env.ELECTRON_START_URL || "http://localhost:3000");
  });
});

/** Util: get BrowserView area (below the tab bar) */
function getBrowserAreaBounds() {
  const { width, height } = mainWindow.getContentBounds();
  const y = TAB_BAR_HEIGHT;
  const h = Math.max(0, height - y);
  return { x: 0, y, width, height: h };
}

/** Create a new tab (BrowserView) */
function createTab(initialUrl = "https://example.com") {
  const id = String(nextTabId++);

  const view = new BrowserView({
    webPreferences: {
      preload: path.join(__dirname, "view-preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Make target="_blank" open in a new in-app tab
  view.webContents.setWindowOpenHandler(({ url }) => {
    const newId = createTab(url);
    switchTab(newId);
    return { action: "deny" };
  });

  // Load page
  view.webContents.loadURL(initialUrl);

  tabs[id] = { id, url: initialUrl, view, title: initialUrl };

  view.webContents.on("page-title-updated", (_evt, title) => {
    tabs[id].title = title || tabs[id].url;
    sendTabsUpdate();
  });

  switchTab(id);
  return id;
}

/** Destroy tab */
function destroyTab(id) {
  const tab = tabs[id];
  if (!tab) return;

  if (activeTabId === id) {
    mainWindow.setBrowserView(null);
    activeTabId = null;
  }
  tab.view.webContents.destroy();
  delete tabs[id];

  const remaining = Object.keys(tabs);
  if (remaining.length) switchTab(remaining[remaining.length - 1]);
  sendTabsUpdate();
}

/** Switch active tab */
function switchTab(id) {
  const tab = tabs[id];
  if (!tab) return;
  activeTabId = id;

  mainWindow.setBrowserView(null);
  mainWindow.setBrowserView(tab.view);

  layoutActiveView();
  sendTabsUpdate();
}

/** Navigate a tab */
function navigateTab(id, url) {
  const tab = tabs[id];
  if (!tab) return;
  tab.url = url;
  tab.view.webContents.loadURL(url);
  sendTabsUpdate();
}

/** Reload tab */
function reloadTab(id) {
  const tab = tabs[id];
  if (!tab) return;
  tab.view.webContents.reload();
}

/** Size the active BrowserView below the tab bar */
function layoutActiveView() {
  if (!activeTabId) return;
  const tab = tabs[activeTabId];
  if (!tab) return;

  const area = getBrowserAreaBounds();
  tab.view.setBounds(area);
  tab.view.setAutoResize({ width: true, height: true });
}

/** Send tab list to renderer */
function sendTabsUpdate() {
  if (!mainWindow) return;
  mainWindow.webContents.send("tabs:update", {
    activeTabId,
    list: Object.values(tabs).map(t => ({
      id: t.id,
      url: t.view.webContents.getURL(),
      title: t.title || t.url,
      active: t.id === activeTabId,
    })),
  });
}

/** Find tabId by a given webContents */
function findTabIdByWebContents(wc) {
  return Object.keys(tabs).find((id) => tabs[id].view.webContents.id === wc.id) || null;
}

/** Relay highlight events from BrowserView → React overlay */
ipcMain.on("highlight:emit", (event, payload) => {
  const tabId = findTabIdByWebContents(event.sender);
  if (!tabId || !mainWindow) return;

  const tab = tabs[tabId];
  const viewBounds = getBrowserAreaBounds();

  mainWindow.webContents.send("overlay:show", {
    tabId,
    url: tab.view.webContents.getURL(),
    selection: payload.text,
    rect: payload.rect,
    viewBounds,
    devicePixelRatio: payload.devicePixelRatio,
  });
});

ipcMain.on("overlay:hide", () => {
  if (!mainWindow) return;
  mainWindow.webContents.send("overlay:hide");
});

ipcMain.on("toggle-live-mode", (event, isOn) => {
  console.log("Live Mode:", isOn ? "ON" : "OFF");
});

ipcMain.on("open-quick-chat", () => {
  console.log("Quick Chat opened");
});

// ---------- IPC API exposed to renderer ----------
ipcMain.handle("tabs:create", (_e, url) => createTab(url || "https://example.com"));
ipcMain.handle("tabs:switch", (_e, id) => (switchTab(id), id));
ipcMain.handle("tabs:close", (_e, id) => (destroyTab(id), true));
ipcMain.handle("tabs:navigate", (_e, { id, url }) => (navigateTab(id, url), true));
ipcMain.handle("tabs:reload", (_e, id) => (reloadTab(id), true));
ipcMain.handle("tabs:list", () => ({
  activeTabId,
  list: Object.values(tabs).map(t => ({
    id: t.id,
    url: t.view.webContents.getURL(),
    title: t.title || t.url,
    active: t.id === activeTabId,
  })),
}));
