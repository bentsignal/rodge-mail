import { describe, expect, it } from "vitest";

import {
  createAgentToken,
  credentialFingerprint,
  hashAgentArguments,
  hashAgentToken,
  isAgentToken,
} from "./token";

describe("agent bearer tokens", () => {
  it("creates unique, fixed-format credentials", () => {
    const first = createAgentToken();
    const second = createAgentToken();

    expect(isAgentToken(first)).toBe(true);
    expect(isAgentToken(second)).toBe(true);
    expect(first).not.toBe(second);
    expect(first).toHaveLength("rodge_agent_".length + 43);
  });

  it("stores a deterministic domain-separated hash, not the bearer token", async () => {
    const token = createAgentToken();
    const hash = await hashAgentToken(token);

    expect(hash).toBe(await hashAgentToken(token));
    expect(hash).not.toContain(token);
    expect(credentialFingerprint(hash)).toBe(hash.slice(0, 16));
  });

  it("binds equivalent arguments to the credential hash", async () => {
    const argumentsHash = await hashAgentArguments('{"query":"invoice"}');
    const first = await hashAgentArguments(`credential-a:${argumentsHash}`);
    const second = await hashAgentArguments(`credential-b:${argumentsHash}`);

    expect(first).not.toBe(second);
  });
});
