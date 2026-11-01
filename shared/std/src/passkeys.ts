import { useState } from "react";

export interface PasskeyListItem {
  aaguid?: string | null;
  createdAt: Date | string;
  id: string;
  name?: string | null;
}

interface DeleteResult {
  error?: { message?: string | null } | null;
}

// Authenticator AAGUIDs from the passkey-authenticator-aaguids registry.
const AUTHENTICATOR_NAMES = new Map([
  ["08987058-cadc-4b81-b6e1-30de50dcbe96", "Windows Hello"],
  ["50726f74-6f6e-5061-7373-50726f746f6e", "Proton Pass"],
  ["531126d6-e717-415c-9320-3d9aa6981239", "Dashlane"],
  ["53414d53-554e-4700-0000-000000000000", "Samsung Pass"],
  ["6028b017-b1d4-4c02-b4b3-afcdafc96bb2", "Windows Hello"],
  ["9ddd1817-af5a-4672-a2b9-3e3dd95000a9", "Windows Hello"],
  ["adce0002-35bc-c60a-648b-0b25f1f05503", "Chrome on Mac"],
  ["bada5566-a7aa-401f-bd96-45619a55120d", "1Password"],
  ["d548826e-79b4-db40-a3d8-11116f7e8349", "Bitwarden"],
  ["dd4ec289-e01d-41c9-bb89-70fa845d4bf2", "iCloud Keychain"],
  ["ea9b8d66-4d01-1d21-3ce4-b6b48cb575d4", "Google Password Manager"],
  ["fbfc3007-154e-4ecc-8c0b-6e020557d7bd", "iCloud Keychain"],
]);

export function getPasskeyLabel(passkey: PasskeyListItem) {
  const name = passkey.name?.trim();
  if (name) return name;
  const aaguid = passkey.aaguid?.toLowerCase() ?? "";
  return AUTHENTICATOR_NAMES.get(aaguid) ?? "Passkey";
}

export function formatPasskeyAdded(createdAt: Date | string) {
  const date = new Date(createdAt).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `Added ${date}`;
}

/**
 * Hides a passkey as soon as its removal starts and shows it again if the
 * server refuses. The last passkey can't be removed: without one, only the
 * email recovery route can sign the owner in.
 */
export function useOptimisticPasskeys<Passkey extends PasskeyListItem>({
  deletePasskey,
  onRemoveError,
  passkeys,
}: {
  deletePasskey: (id: string) => Promise<DeleteResult>;
  onRemoveError: (message: string) => void;
  passkeys: readonly Passkey[] | null | undefined;
}) {
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const visible = (passkeys ?? []).filter(
    (passkey) => !removedIds.has(passkey.id),
  );
  const canRemove = visible.length > 1;

  async function remove(id: string) {
    if (!canRemove) return;
    setRemovedIds((current) => new Set(current).add(id));
    const message = await deleteAndReadError(deletePasskey, id);
    if (message === undefined) return;
    setRemovedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    onRemoveError(message);
  }

  return { canRemove, passkeys: visible, remove };
}

async function deleteAndReadError(
  deletePasskey: (id: string) => Promise<DeleteResult>,
  id: string,
) {
  const fallback = "Couldn't remove the passkey. Try again.";
  try {
    const result = await deletePasskey(id);
    if (!result.error) return undefined;
    const message = result.error.message?.trim();
    if (message) return message;
    return fallback;
  } catch (error) {
    if (error instanceof Error && error.message.trim()) return error.message;
    return fallback;
  }
}
