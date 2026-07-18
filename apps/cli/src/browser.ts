import { spawn } from "node:child_process";

export function openBrowser(url: string, platform = process.platform) {
  const command = browserCommand(url, platform);
  const child = spawn(command.executable, command.arguments, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

export function browserCommand(url: string, platform: NodeJS.Platform) {
  if (platform === "darwin") {
    return { executable: "open", arguments: [url] };
  }
  if (platform === "win32") {
    return { executable: "cmd", arguments: ["/c", "start", "", url] };
  }
  return { executable: "xdg-open", arguments: [url] };
}
