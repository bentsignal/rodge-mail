const fs = require("node:fs");
const path = require("node:path");
const {
  withAndroidManifest,
  withDangerousMod,
} = require("expo/config-plugins");

// Trusts user-installed CAs, such as Portless's local one.
const TRUST_ANCHORS = `    <trust-anchors>
      <certificates src="system" />
      <certificates src="user" />
    </trust-anchors>`;

// With a network security config, Android ignores the debug manifest's
// usesCleartextTraffic, so debug builds (dev clients) allow plain HTTP to
// the Metro hosts here instead. `sim.sh` loads the emulator's JavaScript
// from http://10.0.2.2:<port>.
const METRO_HOSTS = ["10.0.2.2", "localhost", "127.0.0.1"];

function networkSecurityConfig({ debug }) {
  const metro = debug
    ? `
  <domain-config cleartextTrafficPermitted="true">
${METRO_HOSTS.map((host) => `    <domain includeSubdomains="false">${host}</domain>`).join("\n")}
  </domain-config>`
    : "";
  return `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
${TRUST_ANCHORS}
  </base-config>${metro}
</network-security-config>
`;
}

function withAndroidNetworkSecurity(config) {
  config = withAndroidManifest(config, (config) => {
    const application = config.modResults.manifest.application?.[0];

    if (application?.$) {
      application.$["android:networkSecurityConfig"] =
        "@xml/network_security_config";
    }

    return config;
  });

  return withDangerousMod(config, [
    "android",
    (config) => {
      // Debug resources override main ones in debug builds only.
      for (const sourceSet of ["main", "debug"]) {
        const xmlDir = path.join(
          config.modRequest.platformProjectRoot,
          `app/src/${sourceSet}/res/xml`,
        );
        fs.mkdirSync(xmlDir, { recursive: true });
        fs.writeFileSync(
          path.join(xmlDir, "network_security_config.xml"),
          networkSecurityConfig({ debug: sourceSet === "debug" }),
        );
      }

      return config;
    },
  ]);
}

module.exports = withAndroidNetworkSecurity;
module.exports.networkSecurityConfig = networkSecurityConfig;
