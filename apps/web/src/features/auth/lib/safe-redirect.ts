const redirectBase = new URL("https://rodge-mail.invalid");

export function getSafeAppRedirect(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) return "/";
  if (value.includes("\\") || hasControlCharacter(value)) return "/";

  try {
    const destination = new URL(value, redirectBase);
    if (destination.origin !== redirectBase.origin) return "/";
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return "/";
  }
}

function hasControlCharacter(value: string) {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return codePoint < 32 || codePoint === 127;
  });
}
