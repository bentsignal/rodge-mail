/**
 * How smoothly the UI thread drew while recording: every frame it drew, and
 * the ones that took noticeably longer than the screen's refresh. Animations
 * run on the UI thread, so a slow frame there is a visible hitch, whatever
 * JavaScript was doing.
 */
export interface FrameReport {
  readonly frames: number;
  readonly seconds: number;
  /** The screen's refresh rate, from the typical frame. */
  readonly hz: number;
  /** Frames that took over 1.5 refreshes: each is a visible hitch. */
  readonly slow: number;
  /** Refreshes missed in all (a 3-refresh frame misses 2). */
  readonly dropped: number;
  readonly worstMs: number;
  /** The longest slow frames, in milliseconds, longest first (ten at most). */
  readonly worst: readonly number[];
  /** Each slow frame as "<ms from the start>+<ms it took>". */
  readonly timeline: readonly string[];
}

export function summarize(intervals: readonly number[]) {
  "worklet";
  const sorted = [...intervals].sort((a, b) => a - b);
  const typical = sorted[Math.floor(sorted.length / 2)] ?? 1000 / 60;
  const slow = intervals.filter((interval) => interval > typical * 1.5);
  return {
    dropped: intervals.reduce(
      (missed, interval) =>
        missed + Math.max(0, Math.round(interval / typical) - 1),
      0,
    ),
    frames: intervals.length,
    hz: Math.round(1000 / typical),
    seconds:
      Math.round(intervals.reduce((total, interval) => total + interval, 0)) /
      1000,
    slow: slow.length,
    timeline: intervals.flatMap((interval, index) => {
      if (interval <= typical * 1.5) return [];
      const at = intervals
        .slice(0, index)
        .reduce((total, earlier) => total + earlier, 0);
      return [`${Math.round(at)}+${Math.round(interval)}`];
    }),
    worstMs: Math.round(Math.max(0, ...intervals) * 10) / 10,
    worst: [...slow]
      .sort((a, b) => b - a)
      .slice(0, 10)
      .map((interval) => Math.round(interval * 10) / 10),
  } satisfies FrameReport;
}
