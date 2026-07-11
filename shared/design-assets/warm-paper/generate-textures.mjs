import { readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const pnpmModules = join(repoRoot, "node_modules", ".pnpm");

async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch {
    const packages = await readdir(pnpmModules);
    const sharpPackage = packages.find((name) => name.startsWith("sharp@"));

    if (!sharpPackage) {
      throw new Error("Sharp is not installed. Run pnpm install, then retry.");
    }

    const entry = join(
      pnpmModules,
      sharpPackage,
      "node_modules",
      "sharp",
      "lib",
      "index.js",
    );

    return (await import(pathToFileURL(entry).href)).default;
  }
}

const sharp = await loadSharp();
const size = 128;
const tau = Math.PI * 2;

function material(base, strength, phase) {
  const pixels = Buffer.alloc(size * size * 3);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const grain =
        Math.sin((tau * (5 * x + 7 * y)) / size + phase) * 0.42 +
        Math.sin((tau * (13 * x - 3 * y)) / size + phase * 1.7) * 0.28 +
        Math.sin((tau * (29 * x + 11 * y)) / size + phase * 0.6) * 0.18 +
        Math.sin((tau * (2 * x + 31 * y)) / size + phase * 2.1) * 0.12;
      const fiber =
        Math.sin((tau * 9 * y) / size + phase) *
        Math.sin((tau * 2 * x) / size + phase * 0.5) *
        0.22;
      const delta = (grain + fiber) * strength;
      const index = (y * size + x) * 3;

      for (let channel = 0; channel < 3; channel += 1) {
        pixels[index + channel] = Math.max(
          0,
          Math.min(255, Math.round(base[channel] + delta)),
        );
      }
    }
  }

  return pixels;
}

async function writeTexture(name, base, strength, phase) {
  await sharp(material(base, strength, phase), {
    raw: { width: size, height: size, channels: 3 },
  })
    .png({ compressionLevel: 9, palette: true, quality: 100 })
    .toFile(join(here, name));
}

await Promise.all([
  writeTexture("paper-light.png", [255, 253, 246], 3.2, 0.8),
  writeTexture("paper-muted.png", [238, 229, 211], 2.8, 1.9),
  writeTexture("paper-dark.png", [36, 39, 32], 2.4, 2.7),
]);
