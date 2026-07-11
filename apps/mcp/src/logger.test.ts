import { describe, expect, it } from "vitest";

import { AgentAdapterError } from "./errors";
import { createStderrLogger } from "./logger";

describe("redacted adapter diagnostics", () => {
  it("writes only allowlisted metadata and never an error message", () => {
    const secret = "rodge_agent_secret_abcdefghijklmnopqrstuvwxyz";
    const output = new Array<string>();
    const logger = createStderrLogger((value) => output.push(value));
    const error = new AgentAdapterError("INSUFFICIENT_SCOPE", {
      requestId: "request-1",
      status: 403,
    });
    error.message = `Leaked ${secret}`;

    logger.error("tool_request_failed", error, "search_mail");

    expect(output).toHaveLength(1);
    expect(output[0]).toContain('"code":"INSUFFICIENT_SCOPE"');
    expect(output[0]).toContain('"tool":"search_mail"');
    expect(output[0]).not.toContain(secret);
    expect(output[0]).not.toContain("Leaked");
  });
});
