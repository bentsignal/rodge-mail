export function normalizeHostedAddress(value: string) {
  const address = value.trim().toLowerCase();
  const [local, domain, ...rest] = address.split("@");
  if (
    !local ||
    !domain ||
    rest.length > 0 ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/u.test(local) ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/u.test(domain)
  ) {
    throw new Error(`${value} is not a valid address`);
  }
  return { address, domain };
}

export function normalizeHostedDomain(value: string) {
  const domain = value.trim().toLowerCase().replace(/\.$/u, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/u.test(domain)) {
    throw new Error(`${value} is not a valid domain`);
  }
  return domain;
}

export function hostedRemoteMessageId(sesMessageId: string) {
  return `ses:${sesMessageId}`;
}

export function hostedObjectKey(
  remoteMessageId: string,
  direction: "incoming" | "outgoing",
) {
  const sesMessageId = remoteMessageId.replace(/^ses:/u, "");
  if (!/^[\w-]+$/u.test(sesMessageId)) {
    throw new Error("Hosted message identifier is invalid");
  }
  return `${direction === "outgoing" ? "sent" : "inbound"}/${sesMessageId}`;
}

export function hostedAttachmentId(remoteMessageId: string, index: number) {
  return `${remoteMessageId}:attachment:${index}`;
}

export function parseHostedAttachmentIndex(remoteAttachmentId: string) {
  const index = Number(remoteAttachmentId.split(":attachment:")[1]);
  if (!Number.isSafeInteger(index) || index < 0) {
    throw new Error("Hosted attachment identifier is invalid");
  }
  return index;
}

export function sesInternetMessageId(sesMessageId: string, region: string) {
  const host =
    region === "us-east-1" ? "email.amazonses.com" : `${region}.amazonses.com`;
  return `<${sesMessageId}@${host}>`;
}
