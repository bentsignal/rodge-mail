import { spawnSync } from "node:child_process";
import { existsSync, renameSync, rmSync } from "node:fs";
import { resolve } from "node:path";

if (process.platform !== "darwin") {
  throw new Error("The macOS desktop installer must run on macOS.");
}

const source = resolve(
  import.meta.dirname,
  "..",
  "release",
  "mac-arm64",
  "Rodge Mail.app",
);
const installDirectory = "/Applications";
const destination = resolve(installDirectory, "Rodge Mail.app");
const staging = resolve(installDirectory, ".Rodge Mail.installing.app");
const backup = resolve(installDirectory, ".Rodge Mail.previous.app");
const launchServices =
  "/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister";

if (!existsSync(source)) {
  throw new Error(`Packaged app not found at ${source}`);
}

run("codesign", ["--verify", "--deep", "--strict", source]);
terminateRunningApp(destination);

rmSync(staging, { force: true, recursive: true });
rmSync(backup, { force: true, recursive: true });
run("ditto", [source, staging]);
run("codesign", ["--verify", "--deep", "--strict", staging]);

if (existsSync(destination)) renameSync(destination, backup);
try {
  renameSync(staging, destination);
  run("codesign", ["--verify", "--deep", "--strict", destination]);
  rmSync(backup, { force: true, recursive: true });
} catch (error) {
  rmSync(destination, { force: true, recursive: true });
  if (existsSync(backup)) renameSync(backup, destination);
  throw error;
}

run(launchServices, ["-f", destination]);
run("mdimport", ["-i", destination]);
run("open", ["-a", destination]);
console.log(`Installed and opened ${destination}`);

function terminateRunningApp(appPath: string) {
  const executable = `${appPath}/Contents/MacOS/Rodge Mail`;
  const pattern = `^${executable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`;
  const result = spawnSync("pkill", ["-TERM", "-f", pattern], {
    encoding: "utf8",
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `Could not stop ${executable}`);
  }
  if (result.status === 0) run("sleep", ["1"]);
}

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(
      `${command} exited with status ${result.status ?? "unknown"}`,
    );
  }
}
