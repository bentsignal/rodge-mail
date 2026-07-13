export interface UnreadSessionSnapshot<
  Message extends { isRead: boolean; threadId: string },
> {
  messages: Map<string, Message>;
  scopeKey: string;
}

export function preserveUnreadSessionMessage<
  Message extends { isRead: boolean; threadId: string },
>(
  snapshot: UnreadSessionSnapshot<Message> | undefined,
  scopeKey: string,
  message: Message,
) {
  const messages =
    snapshot?.scopeKey === scopeKey
      ? new Map(snapshot.messages)
      : new Map<string, Message>();
  messages.set(message.threadId, { ...message, isRead: true });
  return { messages, scopeKey } satisfies UnreadSessionSnapshot<Message>;
}

export function forgetUnreadSessionMessage<
  Message extends { isRead: boolean; threadId: string },
>(
  snapshot: UnreadSessionSnapshot<Message> | undefined,
  scopeKey: string,
  threadId: string,
) {
  if (snapshot?.scopeKey !== scopeKey) return snapshot;
  const messages = new Map(snapshot.messages);
  messages.delete(threadId);
  return { messages, scopeKey } satisfies UnreadSessionSnapshot<Message>;
}

export function getUnreadSessionMessages<
  Message extends { isRead: boolean; threadId: string },
>(
  snapshot: UnreadSessionSnapshot<Message> | undefined,
  scopeKey: string,
  unreadOnly: boolean,
) {
  if (!unreadOnly || snapshot?.scopeKey !== scopeKey) return [];
  return [...snapshot.messages.values()];
}

export function mergeUnreadSessionMessages<
  Message extends { threadId: string },
>(messages: Message[], preservedMessages: Message[]) {
  const currentThreadIds = new Set(messages.map((message) => message.threadId));
  return [
    ...messages,
    ...preservedMessages.filter(
      (message) => !currentThreadIds.has(message.threadId),
    ),
  ];
}

export function getUnreadSessionScopeKey(
  accountId: string | undefined,
  searchTerm: string,
  viewSessionId: number,
) {
  return `${accountId ?? "all"}:unread:${searchTerm}:${viewSessionId}`;
}
