import { KeyRound, Loader, Plus } from "lucide-react";

import type { PasskeyListItem } from "@rodge-mail/std/passkeys";
import {
  formatPasskeyAdded,
  getPasskeyLabel,
  useOptimisticPasskeys,
} from "@rodge-mail/std/passkeys";
import { toast } from "@rodge-mail/ui-web/toast";

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
      <p className="mail-label mt-6 mb-2 text-[11px] font-medium tracking-wide uppercase">
        Passkeys
      </p>
      <PasskeyList />
      <AddPasskeyButton />
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

function PasskeyList() {
  const query = authClient.useListPasskeys();
  const { canRemove, passkeys, remove } = useOptimisticPasskeys({
    deletePasskey: async (id) => await authClient.passkey.deletePasskey({ id }),
    onRemoveError: (message) => toast.error(message),
    passkeys: query.data,
  });

  if (query.isPending && !query.data) {
    return <div className="bg-muted h-14 animate-pulse rounded-[11px]" />;
  }
  if (passkeys.length === 0) return null;

  return (
    <ul className="divide-border divide-y rounded-[11px] border">
      {passkeys.map((passkey) => (
        <PasskeyRow
          canRemove={canRemove}
          key={passkey.id}
          onRemove={() => void remove(passkey.id)}
          passkey={passkey}
        />
      ))}
    </ul>
  );
}

function PasskeyRow({
  canRemove,
  onRemove,
  passkey,
}: {
  canRemove: boolean;
  onRemove: () => void;
  passkey: PasskeyListItem;
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
        className="hover:bg-accent hover:text-destructive h-8 shrink-0 rounded-[8px] px-2.5 text-xs font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40"
        disabled={!canRemove}
        onClick={onRemove}
        title={canRemove ? undefined : "Your only passkey can't be removed"}
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
