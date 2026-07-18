/* eslint-disable complexity, no-restricted-syntax -- This small CLI parser keeps its discriminated command contract explicit. */
export type Command =
  | { kind: "accounts" }
  | { kind: "auth-login" }
  | { kind: "auth-logout" }
  | { kind: "auth-status" }
  | { kind: "help"; topic?: "auth" | "mail" }
  | {
      accountId?: string;
      cursor?: string;
      kind: "mail-list";
      limit?: number;
    }
  | { kind: "mail-get"; threadId: string }
  | {
      accountId?: string;
      cursor?: string;
      kind: "mail-search";
      limit?: number;
      query: string;
    };

export function parseCommand(arguments_: string[]): Command {
  const normalized = arguments_[0] === "--" ? arguments_.slice(1) : arguments_;
  const [group, action, ...rest] = normalized;
  if (!group || group === "help" || group === "--help" || group === "-h") {
    return { kind: "help" };
  }
  if (group === "auth") return parseAuthCommand(action, rest);
  if (group === "accounts") return { kind: "accounts" };
  if (group === "mail") return parseMailCommand(action, rest);
  throw new Error(`Unknown command: ${group}. Run \`rodge help\`.`);
}

function parseAuthCommand(action: string | undefined, rest: string[]) {
  if (!action || action === "help" || action === "--help") {
    return { kind: "help", topic: "auth" } satisfies Command;
  }
  assertNoArguments(rest, `auth ${action}`);
  if (action === "login") return { kind: "auth-login" } satisfies Command;
  if (action === "logout") return { kind: "auth-logout" } satisfies Command;
  if (action === "status") return { kind: "auth-status" } satisfies Command;
  throw new Error(`Unknown auth command: ${action}. Run \`rodge auth help\`.`);
}

function parseMailCommand(action: string | undefined, rest: string[]): Command {
  if (!action || action === "help" || action === "--help") {
    return { kind: "help", topic: "mail" };
  }
  if (action === "get") {
    const [threadId, ...extra] = rest;
    if (!threadId) throw new Error("mail get requires a thread ID");
    assertNoArguments(extra, "mail get");
    return { kind: "mail-get", threadId };
  }
  const { options, positionals } = parseMailOptions(rest);
  if (action === "list") {
    assertNoArguments(positionals, "mail list");
    return { kind: "mail-list", ...options };
  }
  if (action === "search") {
    if (positionals.length === 0) {
      throw new Error("mail search requires a query");
    }
    return {
      kind: "mail-search",
      query: positionals.join(" "),
      ...options,
    };
  }
  throw new Error(`Unknown mail command: ${action}. Run \`rodge mail help\`.`);
}

function parseMailOptions(values: string[]) {
  const options: { accountId?: string; cursor?: string; limit?: number } = {};
  const positionals = [];
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--account") {
      options.accountId = requiredOptionValue(values, ++index, value);
    } else if (value === "--cursor") {
      options.cursor = requiredOptionValue(values, ++index, value);
    } else if (value === "--limit") {
      const limit = Number(requiredOptionValue(values, ++index, value));
      if (!Number.isInteger(limit) || limit < 1 || limit > 25) {
        throw new Error("--limit must be an integer between 1 and 25");
      }
      options.limit = limit;
    } else if (value?.startsWith("--")) {
      throw new Error(`Unknown option: ${value}`);
    } else if (value) {
      positionals.push(value);
    }
  }
  return { options, positionals };
}

function requiredOptionValue(values: string[], index: number, option: string) {
  const value = values[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function assertNoArguments(values: string[], command: string) {
  if (values.length > 0) {
    throw new Error(`${command} does not accept: ${values.join(" ")}`);
  }
}
