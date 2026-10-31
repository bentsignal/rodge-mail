import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ShieldCheck } from "lucide-react-native";

import type { MobileMailbox } from "../store";
import type { getPageFooter } from "../lib/next-page";
import type { MailboxFilter } from "./mailbox-controls";
import { useColor } from "~/hooks/use-color";
import { getEmptyMailboxCopy } from "./mailbox-empty-state";

export function EmptyInbox({
  isLoading,
  mailbox = "inbox",
  primary,
  searchTerm,
  filter,
}: {
  filter: MailboxFilter;
  isLoading: boolean;
  mailbox?: MobileMailbox;
  primary: string;
  searchTerm?: string;
}) {
  if (isLoading) return <DelayedInboxLoader color={primary} />;
  const copy = getEmptyMailboxCopy({ filter, mailbox, searchTerm });
  return <InboxMessage {...copy} mailbox={mailbox} />;
}

export function InboxFooter({
  state,
}: {
  state: ReturnType<typeof getPageFooter>;
}) {
  if (state === "none") return null;
  return (
    <View className="h-14 items-center justify-center">
      {state === "loading" ? <ActivityIndicator /> : null}
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

function InboxMessage({
  detail,
  mailbox,
  title,
}: {
  detail: string;
  mailbox: MobileMailbox;
  title: string;
}) {
  const mutedForeground = useColor("muted-foreground");
  return (
    <View className="items-center px-8 py-24">
      <SpamEmptyIcon color={mutedForeground} mailbox={mailbox} />
      <Text className="text-foreground text-lg font-bold">{title}</Text>
      <Text className="text-muted-foreground mt-2 text-center leading-5">
        {detail}
      </Text>
    </View>
  );
}

function SpamEmptyIcon({
  color,
  mailbox,
}: {
  color: string;
  mailbox: MobileMailbox;
}) {
  if (mailbox !== "spam") return null;
  return (
    <View className="bg-muted border-border mb-4 size-12 items-center justify-center rounded-2xl border">
      <ShieldCheck color={color} size={22} />
    </View>
  );
}
