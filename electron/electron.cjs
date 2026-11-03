const { app, BrowserWindow, ipcMain, shell } = require("electron");
const fs = require("fs/promises");
const path = require("path");
const { createAttendanceStartupGate } = require('./attendance-startup.cjs');
const attendanceStartup = createAttendanceStartupGate();
const { createInstitutionArchiveSigner } = require('./attendance-archive.cjs');
let archiveSigner;
const signer = () => archiveSigner ||= createInstitutionArchiveSigner(app.getPath('userData'));

const isDev = process.env.NODE_ENV === "development";
let mainWindow = null;

function getDatabasePath() {
  return path.join(app.getPath("userData"), "database.sqlite");
}

function assertTrustedWindow(event) {
  if (!mainWindow || event.sender !== mainWindow.webContents || event.senderFrame !== mainWindow.webContents.mainFrame) {
    throw new Error("Database access is restricted to the application window.");
  }
}

ipcMain.handle("database:read", async (event) => {
  assertTrustedWindow(event);
  try {
    return new Uint8Array(await fs.readFile(getDatabasePath()));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
});

ipcMain.handle('attendance:claim', (event, key) => {
  assertTrustedWindow(event);
  return attendanceStartup.claim(key);
});
ipcMain.handle('attendance:finish', (event, key, token, result) => {
  assertTrustedWindow(event);
  attendanceStartup.finish(key, token, result);
});

ipcMain.handle('attendance:archive-key', (event) => {
  assertTrustedWindow(event);
  return signer().publicKey();
});
ipcMain.handle('attendance:sign-archive', (event, payload) => {
  assertTrustedWindow(event);
  return signer().sign(payload);
});

ipcMain.handle("database:write", async (event, data) => {
  assertTrustedWindow(event);
  if (!(data instanceof Uint8Array)) {
    throw new TypeError("Invalid SQLite database data.");
  }

  const databasePath = getDatabasePath();
  const databaseDirectory = path.dirname(databasePath);
  const temporaryPath = path.join(
    databaseDirectory,
    `database-${process.pid}-${Date.now()}.tmp`
  );

  await fs.mkdir(databaseDirectory, { recursive: true });
  try {
    await fs.writeFile(temporaryPath, data, { flag: "wx" });
    await fs.rename(temporaryPath, databasePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
});

ipcMain.handle("database:delete", async (event) => {
  assertTrustedWindow(event);
  try {
    await fs.unlink(getDatabasePath());
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: "progTalamid",
    autoHideMenuBar: true,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, "progtalamid.ico")
      : path.join(__dirname, "../public/progtalamid.ico"),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });

  mainWindow.webContents.on('did-start-navigation', (_event, _url, isInPlace, isMainFrame) => {
    if (isMainFrame && !isInPlace) attendanceStartup.interrupt();
  });
  mainWindow.webContents.on('render-process-gone', () => attendanceStartup.interrupt());

  if (isDev) {
    mainWindow.loadURL("http://localhost:8580");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../dist-desktop/index.html"));
  }

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url) || /^mailto:/i.test(url)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    attendanceStartup.interrupt();
    mainWindow = null;
  });
}

if (process.platform === "win32") {
  app.setAppUserModelId("com.studentmanagement.app");
}

const ownsInstance = app.requestSingleInstanceLock();
if (!ownsInstance) app.quit();
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

if (ownsInstance) app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
