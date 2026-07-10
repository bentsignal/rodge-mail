import { Server } from "node:net";
import { pathToFileURL } from "node:url";

const EMBEDDED_WEB_READY_MESSAGE = "embedded-web-ready";
const serverEntry = process.env.RODGE_EMBEDDED_SERVER_ENTRY;
const parentPort = process.parentPort;

if (!serverEntry || !parentPort) {
  throw new Error("The embedded web bootstrap is missing its parent context");
}

const originalListen = Server.prototype.listen;
let reportedReady = false;

Server.prototype.listen = function (...args) {
  const normalizedArgs = [...args];
  const options = normalizedArgs[0];

  if (typeof options === "number") {
    normalizedArgs[0] = 0;
    if (typeof normalizedArgs[1] === "string") {
      normalizedArgs[1] = "127.0.0.1";
    } else {
      normalizedArgs.splice(1, 0, "127.0.0.1");
    }
  } else if (options && typeof options === "object") {
    const { path: _path, ...tcpOptions } = options;
    normalizedArgs[0] = {
      ...tcpOptions,
      host: "127.0.0.1",
      port: 0,
    };
  } else {
    throw new Error("The embedded web runtime requested an unsupported socket");
  }

  this.once("listening", () => {
    if (reportedReady) return;

    const address = this.address();
    if (!address || typeof address === "string") {
      throw new Error("The embedded web runtime did not bind a TCP port");
    }

    reportedReady = true;
    parentPort.postMessage({
      port: address.port,
      type: EMBEDDED_WEB_READY_MESSAGE,
    });
  });

  return Reflect.apply(originalListen, this, normalizedArgs);
};

await import(pathToFileURL(serverEntry).href);
