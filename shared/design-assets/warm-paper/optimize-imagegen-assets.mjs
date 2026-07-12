import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..", "..", "..");
const sourceDirectory = join(here, "imagegen-v2", "final");
const outputDirectory = join(
  repoRoot,
  "apps",
  "web",
  "public",
  "warm-paper",
);
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
await mkdir(outputDirectory, { recursive: true });

const paperOutput = join(outputDirectory, "reader-paper.webp");
await sharp(join(sourceDirectory, "paper-texture-selected.png"))
  .resize(1024, 1024, { fit: "cover" })
  .webp({ effort: 6, quality: 82, smartSubsample: true })
  .toFile(paperOutput);

const cornerOutput = join(outputDirectory, "reader-corner.webp");
await sharp(join(sourceDirectory, "folded-corner-selected.png"))
  .trim({ background: { alpha: 0, b: 0, g: 0, r: 0 } })
  .resize({
    fit: "inside",
    height: 256,
    width: 256,
    withoutEnlargement: true,
  })
  .webp({ alphaQuality: 100, effort: 6, lossless: true })
  .toFile(cornerOutput);

for (const asset of [paperOutput, cornerOutput]) {
  const { size } = await stat(asset);
  console.log(`${asset.slice(repoRoot.length + 1)} ${Math.ceil(size / 1024)}KB`);
}
