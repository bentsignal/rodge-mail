interface ReplyAddress {
  address: string;
}

interface ReplyMessage {
  from: ReplyAddress;
  replyTo?: ReplyAddress[];
  to?: ReplyAddress[];
}

export function getReplyAddress(
  messages: readonly ReplyMessage[],
  accountAddress: string,
) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (!message) continue;
    const address = getMessageReplyAddress(message, accountAddress);
    if (address) return address;
  }

  return undefined;
}

function getMessageReplyAddress(message: ReplyMessage, accountAddress: string) {
  const replyTo = message.replyTo?.find(
    (address) => !sameAddress(address.address, accountAddress),
  );
  if (replyTo) return replyTo.address;
  if (!sameAddress(message.from.address, accountAddress)) {
    return message.from.address;
  }
  return message.to?.find(
    (address) => !sameAddress(address.address, accountAddress),
  )?.address;
}

function sameAddress(left: string, right: string) {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
}
