import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = join(
  root,
  "docs/branding/selected-mail-slot/rodge-mail-mail-slot-source.png",
);
const temporaryDirectory = mkdtempSync(
  join(tmpdir(), "rodge-mail-brand-assets-"),
);

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function resize(input, output, size) {
  mkdirSync(dirname(output), { recursive: true });
  run("sips", ["-z", String(size), String(size), input, "--out", output]);
}

function createIco(entries, output) {
  const images = entries.map(({ path, size }) => ({
    bytes: readFileSync(path),
    size,
  }));
  const headerSize = 6 + images.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = headerSize;
  images.forEach(({ bytes, size }, index) => {
    const entryOffset = 6 + index * 16;
    header.writeUInt8(size === 256 ? 0 : size, entryOffset);
    header.writeUInt8(size === 256 ? 0 : size, entryOffset + 1);
    header.writeUInt8(0, entryOffset + 2);
    header.writeUInt8(0, entryOffset + 3);
    header.writeUInt16LE(1, entryOffset + 4);
    header.writeUInt16LE(32, entryOffset + 6);
    header.writeUInt32LE(bytes.length, entryOffset + 8);
    header.writeUInt32LE(offset, entryOffset + 12);
    offset += bytes.length;
  });

  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(
    output,
    Buffer.concat([header, ...images.map(({ bytes }) => bytes)]),
  );
}

try {
  const productionIcon = join(temporaryDirectory, "icon-1024.png");
  resize(source, productionIcon, 1024);

  const mobileAssets = join(root, "apps/mobile/assets");
  copyFileSync(source, join(mobileAssets, "rodge-mail-icon-source.png"));
  copyFileSync(productionIcon, join(mobileAssets, "rounded-icon.png"));
  copyFileSync(productionIcon, join(mobileAssets, "splash-icon.png"));

  const desktopResources = join(root, "apps/desktop/resources");
  copyFileSync(productionIcon, join(desktopResources, "icon.png"));

  const iconset = join(temporaryDirectory, "RodgeMail.iconset");
  mkdirSync(iconset);
  for (const [name, size] of [
    ["icon_16x16.png", 16],
    ["icon_16x16@2x.png", 32],
    ["icon_32x32.png", 32],
    ["icon_32x32@2x.png", 64],
    ["icon_128x128.png", 128],
    ["icon_128x128@2x.png", 256],
    ["icon_256x256.png", 256],
    ["icon_256x256@2x.png", 512],
    ["icon_512x512.png", 512],
    ["icon_512x512@2x.png", 1024],
  ]) {
    resize(source, join(iconset, name), size);
  }
  run("iconutil", [
    "--convert",
    "icns",
    iconset,
    "--output",
    join(desktopResources, "icon.icns"),
  ]);

  const icoEntries = [16, 24, 32, 48, 64, 128, 256].map((size) => {
    const path = join(temporaryDirectory, `icon-${size}.png`);
    resize(source, path, size);
    return { path, size };
  });
  const desktopIco = join(desktopResources, "icon.ico");
  createIco(icoEntries, desktopIco);

  const webPublic = join(root, "apps/web/public");
  for (const [name, size] of [
    ["favicon-16x16.png", 16],
    ["favicon-32x32.png", 32],
    ["apple-touch-icon.png", 180],
    ["icon-192.png", 192],
    ["icon-512.png", 512],
  ]) {
    resize(source, join(webPublic, name), size);
  }
  copyFileSync(desktopIco, join(webPublic, "favicon.ico"));
  copyFileSync(desktopIco, join(root, "apps/web/src/app/favicon.ico"));
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
