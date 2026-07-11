import { describe, expect, it } from "vitest";

import { UNTRUSTED_MAIL_NOTICE } from "./common";
import {
  agentToolDefinitions,
  agentToolNameSchema,
  readOnlyToolAnnotations,
} from "./tools";

describe("agent tool surface", () => {
  it("registers exactly the three read-only tools", () => {
    expect(agentToolDefinitions.map((tool) => tool.name)).toEqual([
      "list_accounts",
      "search_mail",
      "get_thread",
    ]);
    expect(agentToolNameSchema.safeParse("send_mail").success).toBe(false);
    expect(agentToolNameSchema.safeParse("set_read").success).toBe(false);
  });

  it("marks every tool as read-only, idempotent, and closed-world", () => {
    expect(readOnlyToolAnnotations).toEqual({
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    });
    for (const tool of agentToolDefinitions) {
      expect(tool.annotations).toBe(readOnlyToolAnnotations);
      expect(tool.description).toContain(UNTRUSTED_MAIL_NOTICE);
    }
  });

  it("uses strict input objects", () => {
    const listAccounts = agentToolDefinitions[0];
    expect(listAccounts.inputSchema.safeParse({}).success).toBe(true);
    expect(
      listAccounts.inputSchema.safeParse({ includeCredentials: true }).success,
    ).toBe(false);
  });
});
