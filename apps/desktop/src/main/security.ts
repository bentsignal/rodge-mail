import type { BrowserWindow, Session, WebContents } from "electron";
import { shell } from "electron";

import {
  hasSameOrigin,
  isSafeExternalUrl,
  translateDeepLink,
} from "../shared/urls";

const ALLOWED_PERMISSIONS = new Set(["notifications"]);

function permissionIsAllowed(
  webContents: WebContents | null,
  permission: string,
  requestingUrl: string,
  webAppUrl: URL,
) {
  if (!webContents || webContents.isDestroyed()) return false;
  return (
    ALLOWED_PERMISSIONS.has(permission) &&
    hasSameOrigin(requestingUrl, webAppUrl) &&
    hasSameOrigin(webContents.getURL(), webAppUrl)
  );
}

function openExternal(candidate: string) {
  if (!isSafeExternalUrl(candidate)) return;
  void shell.openExternal(candidate).catch(() => undefined);
}

function routeBlockedUrl(
  window: BrowserWindow,
  candidate: string,
  webAppUrl: URL,
) {
  const deepLink = translateDeepLink(candidate, webAppUrl);
  if (deepLink) {
    void window.loadURL(deepLink.href).catch(() => undefined);
    return;
  }
  if (hasSameOrigin(candidate, webAppUrl)) {
    void window.loadURL(candidate).catch(() => undefined);
    return;
  }
  openExternal(candidate);
}

export function secureWindow(window: BrowserWindow, webAppUrl: URL) {
  window.webContents.on("will-navigate", (event, navigationUrl) => {
    if (hasSameOrigin(navigationUrl, webAppUrl)) return;
    event.preventDefault();
    routeBlockedUrl(window, navigationUrl, webAppUrl);
  });
  window.webContents.on("will-redirect", (event, navigationUrl) => {
    if (hasSameOrigin(navigationUrl, webAppUrl)) return;
    event.preventDefault();
    routeBlockedUrl(window, navigationUrl, webAppUrl);
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    routeBlockedUrl(window, url, webAppUrl);
    return { action: "deny" };
  });
}

export function secureSession(appSession: Session, webAppUrl: URL) {
  appSession.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) =>
      permissionIsAllowed(webContents, permission, requestingOrigin, webAppUrl),
  );
  appSession.setPermissionRequestHandler(
    (webContents, permission, callback, details) => {
      callback(
        permissionIsAllowed(
          webContents,
          permission,
          details.requestingUrl,
          webAppUrl,
        ),
      );
    },
  );
}
