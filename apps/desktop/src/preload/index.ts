import { getDesktopRuntimeAttributes } from "../shared/runtime-attributes";

const callbackArgumentPrefix = "--rodge-auth-callback-url=";
const callbackArgument = process.argv.find((argument) =>
  argument.startsWith(callbackArgumentPrefix),
);

window.addEventListener("DOMContentLoaded", () => {
  Object.assign(
    document.documentElement.dataset,
    getDesktopRuntimeAttributes(),
    callbackArgument
      ? {
          desktopAuthCallbackUrl: callbackArgument.slice(
            callbackArgumentPrefix.length,
          ),
        }
      : {},
  );
});
