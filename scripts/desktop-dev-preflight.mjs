import { execFileSync } from "node:child_process";

if (process.platform === "darwin") {
  const processes = execFileSync("ps", ["-axo", "pid=,command="], {
    encoding: "utf8",
  });
  const packagedProcesses = processes
    .split("\n")
    .filter(
      (line) =>
        line.includes("/Rodge Mail.app/Contents/MacOS/Rodge Mail") &&
        !line.includes("/Contents/Frameworks/"),
    );

  if (packagedProcesses.length > 0) {
    console.error(
      [
        "A packaged Rodge Mail build is already running:",
        ...packagedProcesses.map((line) => `  ${line.trim()}`),
        "",
        "Quit it before starting desktop development.",
        "Packaged builds serve their bundled web output; Cmd-R cannot load Vite changes.",
      ].join("\n"),
    );
    process.exit(1);
  }
}

console.log(
  "Starting the Electron development shell against https://www.rodge-mail.local (Vite HMR enabled).",
);
