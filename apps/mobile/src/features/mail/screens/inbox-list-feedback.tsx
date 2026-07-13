import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";

import type { MailboxFilter } from "./mailbox-controls";

export function EmptyInbox({
  isLoading,
  mailbox = "inbox",
  primary,
  searchTerm,
  filter,
}: {
  filter: MailboxFilter;
  isLoading: boolean;
  mailbox?: "archive" | "inbox";
  primary: string;
  searchTerm?: string;
}) {
  if (isLoading) return <DelayedInboxLoader color={primary} />;
  if (searchTerm) {
    return (
      <InboxMessage
        detail={`Nothing matched “${searchTerm}”. Try a sender or a shorter subject.`}
        title="No matching mail"
      />
    );
  }
  if (filter === "unread") {
    return (
      <InboxMessage
        detail="Everything in this view has been read."
        title="No unread messages"
      />
    );
  }
  if (filter === "read") {
    return (
      <InboxMessage
        detail="There are no read conversations in this view."
        title="No read messages"
      />
    );
  }
  if (mailbox === "archive") {
    return (
      <InboxMessage
        detail="Conversations you archive stay here for 30 days."
        title="Archive is empty"
      />
    );
  }
  return (
    <InboxMessage
      detail="New mail will appear here in the order it arrives."
      title="You are caught up"
    />
  );
}

export function InboxFooter({
  isLoading,
  primary,
}: {
  isLoading: boolean;
  primary: string;
}) {
  if (!isLoading) return null;
  return (
    <View className="items-center py-6">
      <ActivityIndicator color={primary} />
    </View>
  );
}

function DelayedInboxLoader({ color }: { color: string }) {
  const [isVisible, setIsVisible] = useState(false);

  // eslint-disable-next-line no-restricted-syntax -- The timeout prevents a transient Convex subscription from flashing a spinner.
  useEffect(() => {
    const timeout = setTimeout(() => setIsVisible(true), 180);
    return () => clearTimeout(timeout);
  }, []);

  if (!isVisible) return <View className="py-24" />;
  return (
    <View className="items-center py-24">
      <ActivityIndicator color={color} size="large" />
    </View>
  );
}

function InboxMessage({ detail, title }: { detail: string; title: string }) {
  return (
    <View className="items-center px-8 py-24">
      <Text className="text-foreground text-lg font-bold">{title}</Text>
      <Text className="text-muted-foreground mt-2 text-center leading-5">
        {detail}
      </Text>
    </View>
  );
}
