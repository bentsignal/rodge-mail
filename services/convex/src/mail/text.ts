// Convex's backend parses function arguments and documents with serde_json,
// which rejects a UTF-16 surrogate that isn't half of a pair ("Invalid
// arguments provided"). Mail decoders can produce one, and so can cutting a
// string in the middle of an emoji.
const LONE_SURROGATE = /\p{Cs}/gu;
export const REPLACEMENT_CHARACTER = String.fromCodePoint(0xfffd);

export function toWellFormed(value: string) {
  return value.replace(LONE_SURROGATE, REPLACEMENT_CHARACTER);
}

export function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  const last = value.charCodeAt(maxLength - 1);
  const splitsPair = last >= 0xd800 && last <= 0xdbff;
  return value.slice(0, splitsPair ? maxLength - 1 : maxLength);
}
