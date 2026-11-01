/**
 * Where a passkey signs in. Website and app passkeys belong to different
 * relying parties, so each platform needs at least one of its own.
 * "unknown" is a passkey stored before Rodge Mail recorded relying
 * parties; "nowhere" is one whose relying party neither platform uses.
 */
export type PasskeySignIn = "app" | "nowhere" | "unknown" | "website";

const passkeySignInPlatforms = ["website", "app"] as const;

const platformNames = { app: "the iPhone app", website: "the website" };

export function getPasskeySignIn(
  rpId: string | null | undefined,
  rpIds: { app: string; website?: string },
) {
  if (!rpId) return "unknown" as const;
  if (rpId === rpIds.app) return "app" as const;
  if (rpIds.website === undefined || rpId === rpIds.website) {
    return "website" as const;
  }
  return "nowhere" as const;
}

/**
 * Why a passkey can't be removed, or undefined if it can. A platform's
 * last known passkey stays. Unknown passkeys never count as a platform's
 * spare, and one can only go once both platforms have a known passkey.
 */
export function getPasskeyRemovalBlock(
  passkeys: readonly { id: string; signsInTo: PasskeySignIn }[],
  id: string,
) {
  const target = passkeys.find((passkey) => passkey.id === id);
  if (!target) return undefined;
  const others = passkeys.filter((passkey) => passkey.id !== id);
  function hasOther(platform: PasskeySignIn) {
    return others.some((passkey) => passkey.signsInTo === platform);
  }

  if (target.signsInTo === "website" || target.signsInTo === "app") {
    if (hasOther(target.signsInTo)) return undefined;
    return `This is your only passkey for ${platformNames[target.signsInTo]}.`;
  }
  if (target.signsInTo === "nowhere") return undefined;

  const unprotected = passkeySignInPlatforms.find(
    (platform) => !hasOther(platform),
  );
  if (!unprotected) return undefined;
  const name = platformNames[unprotected];
  return `This might be your only passkey for ${name}. Sign in to ${name} with it once, or add another passkey there first.`;
}
