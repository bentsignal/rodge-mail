import { isAuthenticated, login, logout } from "./auth.ts";
import { parseCommand } from "./commands.ts";
import { resolveCliUrls } from "./config.ts";
import { help } from "./help.ts";
import { createMailClient } from "./mail-client.ts";

export async function main(arguments_: string[]) {
  const command = parseCommand(arguments_);
  const urls = resolveCliUrls();
  if (command.kind === "help") {
    writeText(help(command.topic));
    return;
  }
  if (command.kind === "auth-login") {
    await login(urls);
    writeJson({ authenticated: true });
    return;
  }
  if (command.kind === "auth-logout") {
    await logout(urls);
    writeJson({ authenticated: false });
    return;
  }
  if (command.kind === "auth-status") {
    writeJson({ authenticated: await isAuthenticated(urls) });
    return;
  }
  const client = await createMailClient(urls);
  if (command.kind === "accounts") {
    writeJson(await client.listAccounts());
  } else if (command.kind === "mail-get") {
    writeJson(await client.getThread(command.threadId));
  } else if (command.kind === "mail-search") {
    writeJson(
      await client.searchMail(command.query, mailPageArguments(command)),
    );
  } else {
    writeJson(await client.listMail(mailPageArguments(command)));
  }
}

function mailPageArguments(command: {
  accountId?: string;
  cursor?: string;
  limit?: number;
}) {
  return {
    ...(command.accountId ? { accountId: command.accountId } : {}),
    ...(command.cursor ? { cursor: command.cursor } : {}),
    ...(command.limit ? { limit: command.limit } : {}),
  };
}

function writeJson(value: unknown) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function writeText(value: string) {
  process.stdout.write(`${value}\n`);
}
