import postgres from "postgres";

import type { EncryptedCredential } from "./credentials";
import { encryptedCredentialSchema } from "./credentials";
import { env } from "./env";

export interface BridgeAccount {
  bridgeAccountId: string;
  ownerId: string;
  address: string;
  displayName?: string;
  imapUsername: string;
  encryptedCredential: EncryptedCredential;
}

export interface MessageState {
  uid: number;
  uidValidity: string;
  remoteMessageId: string;
}

const sql = postgres(env.DATABASE_URL, {
  max: 5,
  idle_timeout: 20,
  connect_timeout: 15,
});

export async function migrateDatabase() {
  await sql`
    create table if not exists icloud_accounts (
      bridge_account_id uuid primary key,
      owner_id text not null,
      address text not null,
      display_name text,
      imap_username text not null,
      encrypted_credential jsonb not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`
    create table if not exists icloud_message_state (
      bridge_account_id uuid not null references icloud_accounts(bridge_account_id) on delete cascade,
      mailbox text not null,
      uid_validity text not null,
      uid bigint not null,
      remote_message_id text not null,
      primary key (bridge_account_id, mailbox, uid_validity, uid)
    )
  `;
  await sql`
    create index if not exists icloud_message_state_remote
    on icloud_message_state (bridge_account_id, remote_message_id)
  `;
  await sql`
    create table if not exists icloud_delivery_state (
      outbox_id text primary key,
      bridge_account_id uuid not null references icloud_accounts(bridge_account_id) on delete cascade,
      remote_message_id text not null,
      sent_at timestamptz not null default now()
    )
  `;
}

export async function saveAccount(account: BridgeAccount) {
  await sql`
    insert into icloud_accounts (
      bridge_account_id,
      owner_id,
      address,
      display_name,
      imap_username,
      encrypted_credential
    ) values (
      ${account.bridgeAccountId},
      ${account.ownerId},
      ${account.address},
      ${account.displayName ?? null},
      ${account.imapUsername},
      ${sql.json(account.encryptedCredential)}
    )
    on conflict (bridge_account_id) do update set
      address = excluded.address,
      display_name = excluded.display_name,
      imap_username = excluded.imap_username,
      encrypted_credential = excluded.encrypted_credential,
      updated_at = now()
  `;
}

export async function deleteAccount(bridgeAccountId: string) {
  await sql`
    delete from icloud_accounts where bridge_account_id = ${bridgeAccountId}
  `;
}

export async function listAccounts() {
  const rows = await sql<
    {
      bridge_account_id: string;
      owner_id: string;
      address: string;
      display_name: string | null;
      imap_username: string;
      encrypted_credential: unknown;
    }[]
  >`
    select bridge_account_id, owner_id, address, display_name, imap_username, encrypted_credential
    from icloud_accounts
    order by created_at
  `;
  return rows.map(toBridgeAccount);
}

export async function getAccount(bridgeAccountId: string) {
  const rows = await sql<
    {
      bridge_account_id: string;
      owner_id: string;
      address: string;
      display_name: string | null;
      imap_username: string;
      encrypted_credential: unknown;
    }[]
  >`
    select bridge_account_id, owner_id, address, display_name, imap_username, encrypted_credential
    from icloud_accounts
    where bridge_account_id = ${bridgeAccountId}
  `;
  return rows[0] ? toBridgeAccount(rows[0]) : null;
}

export async function listMessageStates(
  bridgeAccountId: string,
  mailbox: string,
) {
  const rows = await sql<
    { uid: string; uid_validity: string; remote_message_id: string }[]
  >`
    select uid, uid_validity, remote_message_id
    from icloud_message_state
    where bridge_account_id = ${bridgeAccountId} and mailbox = ${mailbox}
  `;
  return rows.map((row) => ({
    uid: Number(row.uid),
    uidValidity: row.uid_validity,
    remoteMessageId: row.remote_message_id,
  }));
}

export async function replaceMailboxState(
  bridgeAccountId: string,
  mailbox: string,
  states: MessageState[],
) {
  await sql.begin(async (transaction) => {
    await transaction`
      delete from icloud_message_state
      where bridge_account_id = ${bridgeAccountId} and mailbox = ${mailbox}
    `;
    for (const state of states) {
      await transaction`
        insert into icloud_message_state (
          bridge_account_id,
          mailbox,
          uid_validity,
          uid,
          remote_message_id
        ) values (
          ${bridgeAccountId},
          ${mailbox},
          ${state.uidValidity},
          ${state.uid},
          ${state.remoteMessageId}
        )
      `;
    }
  });
}

export async function getDeliveryState(
  bridgeAccountId: string,
  outboxId: string,
) {
  const rows = await sql<{ remote_message_id: string }[]>`
    select remote_message_id
    from icloud_delivery_state
    where bridge_account_id = ${bridgeAccountId} and outbox_id = ${outboxId}
  `;
  return rows[0]?.remote_message_id ?? null;
}

export async function saveDeliveryState(
  bridgeAccountId: string,
  outboxId: string,
  remoteMessageId: string,
) {
  await sql`
    insert into icloud_delivery_state (
      bridge_account_id,
      outbox_id,
      remote_message_id
    ) values (${bridgeAccountId}, ${outboxId}, ${remoteMessageId})
    on conflict (outbox_id) do update set
      remote_message_id = excluded.remote_message_id
  `;
}

export async function closeDatabase() {
  await sql.end({ timeout: 5 });
}

function toBridgeAccount(row: {
  bridge_account_id: string;
  owner_id: string;
  address: string;
  display_name: string | null;
  imap_username: string;
  encrypted_credential: unknown;
}) {
  return {
    bridgeAccountId: row.bridge_account_id,
    ownerId: row.owner_id,
    address: row.address,
    displayName: row.display_name ?? undefined,
    imapUsername: row.imap_username,
    encryptedCredential: encryptedCredentialSchema.parse(
      row.encrypted_credential,
    ),
  };
}
