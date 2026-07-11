export class AgentAdapterError extends Error {
  readonly code: string;
  readonly requestId?: string;
  readonly status?: number;

  constructor(
    code: string,
    options: { requestId?: string; status?: number } = {},
  ) {
    super(code);
    this.name = "AgentAdapterError";
    this.code = code;
    this.requestId = options.requestId;
    this.status = options.status;
  }
}

export function adapterErrorCode(error: unknown) {
  return error instanceof AgentAdapterError ? error.code : "ADAPTER_ERROR";
}
