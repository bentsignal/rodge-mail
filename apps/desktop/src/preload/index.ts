import { getDesktopRuntimeAttributes } from "../shared/runtime-attributes";

window.addEventListener("DOMContentLoaded", () => {
  Object.assign(
    document.documentElement.dataset,
    getDesktopRuntimeAttributes(),
  );
});
