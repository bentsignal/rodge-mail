import { adapterErrorCode, AgentAdapterError } from "./errors.ts";

export interface AdapterLogger {
  error: (event: string, error: unknown, tool?: string) => void;
}

export function createStderrLogger(
  write: (value: string) => void = (value) => process.stderr.write(value),
) {
  return {
    error(event: string, error: unknown, tool?: string) {
      const adapterError =
        error instanceof AgentAdapterError ? error : undefined;
      write(
        `${JSON.stringify({
          event,
          code: adapterErrorCode(error),
          requestId: adapterError?.requestId,
          status: adapterError?.status,
          tool,
        })}\n`,
      );
    },
  } satisfies AdapterLogger;
}
