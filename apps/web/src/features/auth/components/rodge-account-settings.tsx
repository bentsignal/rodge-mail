import { KeyRound, Loader, Plus } from "lucide-react";

import type { PasskeyListItem, PasskeyRow } from "@rodge-mail/std/passkeys";
import {
  formatPasskeyAdded,
  getPasskeyLabel,
  useOptimisticPasskeys,
} from "@rodge-mail/std/passkeys";
import { toast } from "@rodge-mail/ui-web/toast";

import { urls } from "~/urls";
import { authClient } from "../lib/client";
import { useAuthStore } from "../store";
import { SignOutLink } from "./sign-out-link";

export function RodgeAccountSettings() {
  return (
    <section aria-labelledby="rodge-account-heading">
      <h2 className="text-sm font-semibold" id="rodge-account-heading">
        Rodge Mail account
      </h2>
      <OwnerIdentity />
      <Passkeys />
      <div className="border-border mt-6 border-t pt-6">
        <SignOutLink variant="settings" />
      </div>
    </section>
  );
}

function OwnerIdentity() {
  const session = authClient.useSession();
  const user = session.data?.user;
  if (!user) return <div className="mt-4 h-11" />;

  return (
    <div className="mt-4 flex items-center gap-3">
      <span
        aria-hidden="true"
        className="bg-muted flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold"
      >
        {getInitials(user.name || user.email)}
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{user.name}</p>
        <p className="mail-label truncate text-xs">{user.email}</p>
      </div>
    </div>
  );
}

const appRpId = new URL(urls.convex.site).hostname;

function Passkeys() {
  const query = authClient.useListPasskeys();
  const { groups, remove } = useOptimisticPasskeys({
    appRpId,
    deletePasskey: async (id) => await authClient.passkey.deletePasskey({ id }),
    onRemoveError: (message) => toast.error(message),
    passkeys: query.data,
  });

  return (
    <>
      <PasskeyGroupLabel>Website passkeys</PasskeyGroupLabel>
      <PasskeyList
        isLoading={query.isPending && !query.data}
        onRemove={remove}
        rows={groups.website}
      />
      <AddPasskeyButton />
      <PasskeyGroup
        label="iPhone app passkeys"
        onRemove={remove}
        rows={groups.app}
      />
      <PasskeyGroup
        label="Other passkeys"
        onRemove={remove}
        rows={groups.unknown}
      />
    </>
  );
}

function PasskeyGroupLabel({ children }: { children: string }) {
  return (
    <p className="mail-label mt-6 mb-2 text-[11px] font-medium tracking-wide uppercase">
      {children}
    </p>
  );
}

function PasskeyGroup({
  label,
  onRemove,
  rows,
}: {
  label: string;
  onRemove: (id: string) => Promise<void>;
  rows: readonly PasskeyRow<PasskeyListItem>[];
}) {
  if (rows.length === 0) return null;
  return (
    <>
      <PasskeyGroupLabel>{label}</PasskeyGroupLabel>
      <PasskeyList onRemove={onRemove} rows={rows} />
    </>
  );
}

function PasskeyList({
  isLoading = false,
  onRemove,
  rows,
}: {
  isLoading?: boolean;
  onRemove: (id: string) => Promise<void>;
  rows: readonly PasskeyRow<PasskeyListItem>[];
}) {
  if (isLoading) {
    return <div className="bg-muted h-14 animate-pulse rounded-[11px]" />;
  }
  if (rows.length === 0) return null;
  return (
    <ul className="divide-border divide-y rounded-[11px] border">
      {rows.map(({ passkey, removalBlock }) => (
        <PasskeyItem
          key={passkey.id}
          onRemove={() => void onRemove(passkey.id)}
          passkey={passkey}
          removalBlock={removalBlock}
        />
      ))}
    </ul>
  );
}

function PasskeyItem({
  onRemove,
  passkey,
  removalBlock,
}: {
  onRemove: () => void;
  passkey: PasskeyListItem;
  removalBlock: string | undefined;
}) {
  const label = getPasskeyLabel(passkey);

  return (
    <li className="flex items-center gap-3 px-3.5 py-3">
      <KeyRound className="text-muted-foreground size-4 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{label}</p>
        <p className="mail-label text-xs">
          {formatPasskeyAdded(passkey.createdAt)}
        </p>
      </div>
      <button
        aria-label={`Remove ${label}`}
        className="enabled:hover:bg-accent enabled:hover:text-destructive h-8 shrink-0 rounded-[8px] px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        disabled={removalBlock !== undefined}
        onClick={onRemove}
        title={removalBlock}
        type="button"
      >
        Remove
      </button>
    </li>
  );
}

function AddPasskeyButton() {
  const addPasskey = useAuthStore((store) => store.addAuthenticatedPasskey);
  const isLoading = useAuthStore((store) => store.isLoading);

  return (
    <button
      className="hover:bg-accent mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[10px] border text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isLoading}
      onClick={() => void addPasskey()}
      type="button"
    >
      <AddIcon isLoading={isLoading} />
      Add passkey
    </button>
  );
}

function AddIcon({ isLoading }: { isLoading: boolean }) {
  if (isLoading) return <Loader className="size-4 animate-spin" />;
  return <Plus className="size-4" />;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}
