import { describe, expect, it } from "vitest";

import type { AgentHttpError } from "./http";
import { parseBearer, readBoundedBody } from "./http";
import { createAgentToken } from "./token";

describe("agent HTTP boundary", () => {
  it("accepts a case-insensitive Bearer scheme with one exact token", () => {
    const token = createAgentToken();

    expect(parseBearer(`Bearer ${token}`)).toBe(token);
    expect(parseBearer(`bearer ${token}`)).toBe(token);
  });

  it.each([
    null,
    "",
    "Basic value",
    "Bearer rodge_agent_bad",
    `Bearer ${createAgentToken()},other`,
    `Bearer ${createAgentToken()} trailing`,
  ])("rejects malformed authorization: %s", (value) => {
    expect(() => parseBearer(value)).toThrowError(
      expect.objectContaining({ code: "INVALID_CREDENTIAL", status: 401 }),
    );
  });

  it("enforces request limits in bytes, including multibyte input", async () => {
    const request = new Request("https://example.test", {
      body: "éé",
      method: "POST",
    });

    await expect(readBoundedBody(request, 3)).rejects.toMatchObject({
      code: "REQUEST_TOO_LARGE",
      status: 413,
    } satisfies Partial<AgentHttpError>);
  });
});
