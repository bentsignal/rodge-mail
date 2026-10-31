import { scheduleOnRN, scheduleOnUI } from "react-native-worklets";

import type { FrameReport } from "./frame-summary";
import { summarize } from "./frame-summary";

interface Recording {
  last: number;
  intervals: number[];
}

declare global {
  var rodgeFrames: Recording | undefined;
}

let report: FrameReport | null | undefined;

function setReport(next: FrameReport | null) {
  report = next;
}

/** Starts recording the UI thread's frames, replacing any recording. */
export function startFrames() {
  scheduleOnUI(() => {
    "worklet";
    const recording = {
      intervals: new Array<number>(),
      last: 0,
    } satisfies Recording;
    globalThis.rodgeFrames = recording;
    function tick(time: number) {
      "worklet";
      if (globalThis.rodgeFrames !== recording) return;
      if (recording.last > 0) recording.intervals.push(time - recording.last);
      recording.last = time;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

/**
 * Stops recording; the report follows in `frameReport()` a moment later,
 * from the UI thread. Hermes's debugger can't wait on a promise, so scripts
 * poll for it.
 */
export function stopFrames() {
  report = undefined;
  scheduleOnUI(() => {
    "worklet";
    const recording = globalThis.rodgeFrames;
    globalThis.rodgeFrames = undefined;
    scheduleOnRN(
      setReport,
      recording === undefined ? null : summarize(recording.intervals),
    );
  });
}

export function frameReport() {
  return report;
}
