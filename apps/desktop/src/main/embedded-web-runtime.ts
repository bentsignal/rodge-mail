export const EMBEDDED_WEB_READY_MESSAGE = "embedded-web-ready";

export function readEmbeddedWebReadyPort(message: unknown) {
  if (!message || typeof message !== "object") return undefined;

  if (
    !("type" in message) ||
    message.type !== EMBEDDED_WEB_READY_MESSAGE ||
    !("port" in message) ||
    typeof message.port !== "number" ||
    !Number.isInteger(message.port) ||
    message.port < 1 ||
    message.port > 65_535
  ) {
    return undefined;
  }

  return message.port;
}
