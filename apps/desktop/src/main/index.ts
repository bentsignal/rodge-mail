import { join } from "node:path";
import { app, BrowserWindow, dialog, session } from "electron";

import { APP_PROTOCOL } from "../shared/constants";
import { resolveWebAppUrl, translateDeepLink } from "../shared/urls";
import { desktopEnv } from "./env";
import { secureSession, secureWindow } from "./security";

let mainWindow: BrowserWindow | undefined;
let pendingDeepLink: string | undefined;
let webAppUrl: URL | undefined;

function findDeepLink(argv: string[]) {
  return argv.find((value) =>
    value.toLowerCase().startsWith(`${APP_PROTOCOL}://`),
  );
}

function showStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  dialog.showErrorBox("Rodge Mail could not start", message);
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
}

function navigateDeepLink(candidate: string) {
  if (!webAppUrl || !mainWindow || mainWindow.isDestroyed()) {
    pendingDeepLink = candidate;
    return;
  }

  const destination = translateDeepLink(candidate, webAppUrl);
  if (!destination) return;
  void mainWindow.loadURL(destination.href).catch(showStartupError);
  focusMainWindow();
}

async function createMainWindow() {
  if (!webAppUrl) return;

  const window = new BrowserWindow({
    title: "Rodge Mail",
    width: 1280,
    height: 840,
    minWidth: 860,
    minHeight: 600,
    show: false,
    backgroundColor: "#111111",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      preload: join(import.meta.dirname, "../preload/index.mjs"),
    },
  });

  mainWindow = window;
  secureWindow(window, webAppUrl);
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = undefined;
  });

  const initialDeepLink = pendingDeepLink;
  pendingDeepLink = undefined;
  const destination = initialDeepLink
    ? translateDeepLink(initialDeepLink, webAppUrl)
    : undefined;
  await window.loadURL(destination?.href ?? webAppUrl.href);
}

async function start() {
  webAppUrl = resolveWebAppUrl({
    configuredUrl: desktopEnv.webUrl,
    isPackaged: app.isPackaged,
  });
  secureSession(session.defaultSession, webAppUrl);
  app.on("web-contents-created", (_event, contents) => {
    contents.on("will-attach-webview", (event) => event.preventDefault());
  });

  if (app.isPackaged) app.setAsDefaultProtocolClient(APP_PROTOCOL);
  await createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createMainWindow().catch(showStartupError);
    }
  });
}

function registerAppEvents() {
  app.on("open-url", (event, url) => {
    event.preventDefault();
    navigateDeepLink(url);
  });
  app.on("second-instance", (_event, argv) => {
    const deepLink = findDeepLink(argv);
    if (deepLink) navigateDeepLink(deepLink);
    focusMainWindow();
  });
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  pendingDeepLink = findDeepLink(process.argv);
  registerAppEvents();
  void app
    .whenReady()
    .then(start)
    .catch((error: unknown) => {
      showStartupError(error);
      app.quit();
    });
}
