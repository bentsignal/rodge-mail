export interface RecipientAddress {
  address: string;
  name?: string;
}

export interface RecipientParseResult {
  invalid: string[];
  recipients: RecipientAddress[];
}

export interface RecipientFieldsResult {
  invalid: RecipientFields<string[]>;
  recipients: RecipientFields<RecipientAddress[]>;
}

export interface RecipientFields<Value> {
  bcc: Value;
  cc: Value;
  to: Value;
}

export function parseRecipientFields(values: RecipientFields<string>) {
  return combineRecipientFields({
    bcc: parseRecipientList(values.bcc),
    cc: parseRecipientList(values.cc),
    to: parseRecipientList(values.to),
  });
}

export function normalizeRecipientFields(
  values: RecipientFields<readonly { address: string; name?: string }[]>,
) {
  return combineRecipientFields({
    bcc: normalizeRecipients(values.bcc),
    cc: normalizeRecipients(values.cc),
    to: normalizeRecipients(values.to),
  });
}

export function parseRecipientList(value: string) {
  const recipients = new Array<RecipientAddress>();
  const invalid = new Array<string>();
  const seen = new Set<string>();

  for (const token of splitRecipientList(value)) {
    const parsed = parseRecipient(token);
    if (!parsed) {
      invalid.push(token);
      continue;
    }
    const key = parsed.address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(parsed);
  }
  return { invalid, recipients };
}

export function normalizeRecipients(
  values: readonly { address: string; name?: string }[],
) {
  const recipients = new Array<RecipientAddress>();
  const invalid = new Array<string>();
  const seen = new Set<string>();

  for (const value of values) {
    const address = normalizeEmailAddress(value.address);
    const name = value.name?.trim();
    if (!address || (name && /[<>\r\n]/u.test(name))) {
      invalid.push(value.address);
      continue;
    }
    const key = address.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push(name ? { address, name } : { address });
  }
  return { invalid, recipients };
}

function combineRecipientFields(
  results: RecipientFields<RecipientParseResult>,
) {
  const seen = new Set<string>();
  const to = filterUnseenRecipients(results.to.recipients, seen);
  const cc = filterUnseenRecipients(results.cc.recipients, seen);
  const bcc = filterUnseenRecipients(results.bcc.recipients, seen);
  return {
    invalid: {
      bcc: results.bcc.invalid,
      cc: results.cc.invalid,
      to: results.to.invalid,
    },
    recipients: { bcc, cc, to },
  };
}

function filterUnseenRecipients(
  recipients: RecipientAddress[],
  seen: Set<string>,
) {
  return recipients.filter((recipient) => {
    const key = recipient.address.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseRecipient(value: string) {
  const displayMatch = /^([^<>]*)<([^<>]+)>$/u.exec(value);
  if (displayMatch) {
    const address = normalizeEmailAddress(displayMatch[2] ?? "");
    const name = normalizeDisplayName(displayMatch[1] ?? "");
    if (!address || name === undefined) return undefined;
    return name ? { address, name } : { address };
  }
  const address = normalizeEmailAddress(value);
  return address ? { address } : undefined;
}

function normalizeDisplayName(value: string) {
  const name = value.trim();
  if (!name) return "";
  if (!name.startsWith('"') && !name.endsWith('"')) {
    return name.includes('"') ? undefined : name;
  }
  if (name.length < 2 || !name.startsWith('"') || !name.endsWith('"')) {
    return undefined;
  }
  return name
    .slice(1, -1)
    .replaceAll(/\\(["\\])/gu, "$1")
    .trim();
}

function normalizeEmailAddress(value: string) {
  const address = value.trim().toLowerCase();
  if (address.length > 254) return undefined;
  const at = address.indexOf("@");
  if (at <= 0 || at !== address.lastIndexOf("@")) return undefined;
  const local = address.slice(0, at);
  const domain = address.slice(at + 1);
  if (!isValidLocalPart(local) || !isValidDomain(domain)) return undefined;
  return address;
}

function isValidLocalPart(value: string) {
  if (value.length > 64 || value.startsWith(".") || value.endsWith(".")) {
    return false;
  }
  if (value.includes("..")) return false;
  return /^[a-z0-9!#$%&'*+/=?^_`{|}~.-]+$/u.test(value);
}

function isValidDomain(value: string) {
  if (value.length > 253) return false;
  const labels = value.split(".");
  if (labels.length < 2) return false;
  if (!/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/u.test(labels.at(-1) ?? "")) {
    return false;
  }
  return labels.every(
    (label) =>
      label.length > 0 &&
      label.length <= 63 &&
      /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u.test(label),
  );
}

function splitRecipientList(value: string) {
  const tokens = new Array<string>();
  let start = 0;
  const state = { angleDepth: 0, escaped: false, inQuotes: false };

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const shouldSplit = isRecipientSeparator(character, state);
    updateParserState(character, state);
    if (shouldSplit) {
      addToken(tokens, value.slice(start, index));
      start = index + 1;
    }
  }
  addToken(tokens, value.slice(start));
  return tokens;
}

function isRecipientSeparator(
  character: string | undefined,
  state: { angleDepth: number; inQuotes: boolean },
) {
  return (
    !state.inQuotes &&
    state.angleDepth === 0 &&
    (character === "," || character === ";")
  );
}

function updateParserState(
  character: string | undefined,
  state: { angleDepth: number; escaped: boolean; inQuotes: boolean },
) {
  if (state.escaped) {
    state.escaped = false;
    return;
  }
  if (character === "\\" && state.inQuotes) {
    state.escaped = true;
    return;
  }
  if (character === '"') state.inQuotes = !state.inQuotes;
  if (!state.inQuotes && character === "<") state.angleDepth += 1;
  if (!state.inQuotes && character === ">") {
    state.angleDepth = Math.max(0, state.angleDepth - 1);
  }
}

function addToken(tokens: string[], value: string) {
  const token = value.trim();
  if (token) tokens.push(token);
}
