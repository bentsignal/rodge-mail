const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");
const path = require("node:path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot, {
  isCSSEnabled: true,
});

config.watchFolders = [...(config.watchFolders ?? []), workspaceRoot];

config.resolver.nodeModulesPaths = [
  ...(config.resolver.nodeModulesPaths ?? []),
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.unstable_enablePackageExports = true;

/** @type {import('expo/metro-config').MetroConfig} */
module.exports = withUniwindConfig(config, {
  cssEntryFile: "./src/styles.css",
  dtsFile: "./uniwind-types.d.ts",
});
