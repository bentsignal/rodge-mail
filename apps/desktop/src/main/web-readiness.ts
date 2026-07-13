interface WebReadinessOptions {
  now?: () => number;
  retryIntervalMs?: number;
  sleep?: (durationMs: number) => Promise<void>;
  timeoutMs?: number;
}

function defaultSleep(durationMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, durationMs));
}

function resolveOptions(options: WebReadinessOptions) {
  return {
    now: options.now ?? Date.now,
    retryIntervalMs: options.retryIntervalMs ?? 250,
    sleep: options.sleep ?? defaultSleep,
    timeoutMs: options.timeoutMs ?? 30_000,
  };
}

export async function waitForWebAppReady(
  webAppUrl: URL,
  probe: () => Promise<number>,
  options: WebReadinessOptions = {},
) {
  const { now, retryIntervalMs, sleep, timeoutMs } = resolveOptions(options);
  const deadline = now() + timeoutMs;
  let lastError: unknown;
  let lastStatus: number | undefined;

  while (true) {
    try {
      const status = await probe();
      if (status >= 200 && status < 400) return;
      lastStatus = status;
      lastError = undefined;
    } catch (error) {
      lastError = error;
      lastStatus = undefined;
    }

    const remainingMs = deadline - now();
    if (remainingMs <= 0) break;
    await sleep(Math.min(retryIntervalMs, remainingMs));
  }

  const detail =
    lastStatus === undefined ? "the request failed" : `HTTP ${lastStatus}`;
  throw new Error(
    `The web app at ${webAppUrl.origin} did not become ready within ${timeoutMs}ms (${detail})`,
    { cause: lastError },
  );
}
