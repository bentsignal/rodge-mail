const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

const DEPLOYMENT_TARGET = "16.4";
const MARKER = "Rodge Mail force iOS pods deployment target";

function createPostInstallSnippet() {
  return [
    `  # ${MARKER}`,
    "  installer.pods_project.targets.each do |target|",
    "    target.build_configurations.each do |config|",
    `      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${DEPLOYMENT_TARGET}'`,
    "    end",
    "  end",
  ].join("\n");
}

function patchPodfile(contents) {
  if (contents.includes(MARKER)) {
    return contents;
  }

  const lines = contents.split("\n");
  const postInstallStart = lines.findIndex((line) =>
    line.includes("post_install do |installer|"),
  );
  if (postInstallStart < 0) {
    throw new Error("Could not find post_install block in generated Podfile");
  }

  let depth = 1;
  for (let index = postInstallStart + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (opensRubyBlock(line)) {
      depth += 1;
    }
    if (/^\s*end\s*$/.test(line)) {
      depth -= 1;
      if (depth === 0) {
        lines.splice(index, 0, createPostInstallSnippet());
        return lines.join("\n");
      }
    }
  }

  throw new Error(
    "Could not find end of post_install block in generated Podfile",
  );
}

function opensRubyBlock(line) {
  const trimmed = line.trim();
  return (
    /\bdo(\s*\|.*\|)?\s*$/.test(trimmed) ||
    /^(if|unless|case|begin)\b/.test(trimmed)
  );
}

module.exports = function withIosPodsDeploymentTarget(config) {
  return withDangerousMod(config, [
    "ios",
    (config) => {
      const podfilePath = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile",
      );
      const podfile = fs.readFileSync(podfilePath, "utf8");
      fs.writeFileSync(podfilePath, patchPodfile(podfile));

      return config;
    },
  ]);
};
