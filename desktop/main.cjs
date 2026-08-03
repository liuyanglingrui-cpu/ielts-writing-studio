const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const fs = require("node:fs/promises");
const path = require("node:path");
const { buildWritingDocx } = require("./docx-export.cjs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1060,
    minHeight: 700,
    backgroundColor: "#f4f6f5",
    icon: path.join(__dirname, "assets", "app-icon.png"),
    frame: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
  mainWindow.once("ready-to-show", () => mainWindow.show());
}

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

ipcMain.on("window:minimize", () => mainWindow?.minimize());
ipcMain.on("window:maximize", () => {
  if (!mainWindow) return;
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on("window:close", () => mainWindow?.close());

function practiceDataPath() {
  return path.join(app.getPath("userData"), "writing-practice.json");
}

ipcMain.handle("practice:load", async () => {
  try {
    const raw = await fs.readFile(practiceDataPath(), "utf8");
    return { status: "loaded", data: JSON.parse(raw), filePath: practiceDataPath() };
  } catch (error) {
    if (error && error.code === "ENOENT") return { status: "empty", filePath: practiceDataPath() };
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("practice:save", async (_event, data) => {
  try {
    await fs.mkdir(path.dirname(practiceDataPath()), { recursive: true });
    await fs.writeFile(practiceDataPath(), JSON.stringify(data, null, 2), "utf8");
    return { status: "saved", filePath: practiceDataPath() };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("document:export", async (_event, payload) => {
  const hasTask = [payload?.tasks?.task1, payload?.tasks?.task2].some((task) => task?.prompt?.trim());
  if (!hasTask) return { status: "error", message: "请先为 Task 1 或 Task 2 添加题目。" };
  const suggestedName = `IELTS-Writing-${new Date().toISOString().slice(0, 10)}.docx`;
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "导出 IELTS 写作练习",
    defaultPath: path.join(app.getPath("documents"), suggestedName),
    filters: [{ name: "Word 文档", extensions: ["docx"] }],
  });

  if (result.canceled || !result.filePath) return { status: "cancelled" };

  try {
    const buffer = await buildWritingDocx(payload);
    await fs.writeFile(result.filePath, buffer);
    return { status: "saved", filePath: result.filePath };
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : String(error) };
  }
});
