export type UnreadSelectionResolution<Message> =
  | { type: "clear" }
  | { type: "preserve" }
  | { message: Message; type: "select" };

export function resolveUnreadSelection<
  Message extends { _id: string; threadId: string },
>({
  isLoading,
  isLoadingSelectedThread,
  messages,
  selectedThreadIsUnread,
  selectedThreadId,
  unreadOnly,
}: {
  isLoading: boolean;
  isLoadingSelectedThread: boolean;
  messages: Message[];
  selectedThreadIsUnread: boolean | undefined;
  selectedThreadId: string | undefined;
  unreadOnly: boolean;
}) {
  if (
    !unreadOnly ||
    isLoading ||
    isLoadingSelectedThread ||
    !selectedThreadId ||
    selectedThreadIsUnread === true ||
    messages.some((message) => message.threadId === selectedThreadId)
  ) {
    const resolution = {
      type: "preserve",
    } satisfies UnreadSelectionResolution<Message>;
    return resolution;
  }

  const nextMessage = messages[0];
  if (!nextMessage) {
    const resolution = {
      type: "clear",
    } satisfies UnreadSelectionResolution<Message>;
    return resolution;
  }
  const resolution = {
    message: nextMessage,
    type: "select",
  } satisfies UnreadSelectionResolution<Message>;
  return resolution;
}
