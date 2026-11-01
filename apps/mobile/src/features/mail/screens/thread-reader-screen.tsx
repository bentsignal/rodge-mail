import type { FunctionReturnType } from "convex/server";
import type { LayoutChangeEvent } from "react-native";
import { useEffect, useRef, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";

import type { MailMessage, MailThread } from "@rodge-mail/features/mail";
import { api } from "@rodge-mail/convex/api";
import {
  canMoveMailThreadToInbox,
  getMailThreadPlacement,
  getReplyAddress,
} from "@rodge-mail/features/mail";

import type { MobileMailbox } from "../store";
import type { MessageViewMode } from "./thread-message-body";
import type { CleanViewMenuAction } from "./thread-reader-toolbar";
import { ContentReveal } from "~/components/content-reveal";
import { PostalPaperBackground } from "~/features/theme/postal-surface";
import { toConvexId } from "../lib/convex-id";
import { toMailThreadDetail } from "../lib/convex-mail";
import { CleanViewCodeCard } from "./clean-view-code-card";
import { optimisticallyGenerateCleanView } from "./clean-view-optimistic";
import {
  hasGeneratedCleanView,
  isPreparingCleanView,
} from "./clean-view-status";
import { parseMobileMailbox } from "./mailbox-controls";
import { MessageViewToolbar } from "./message-view-toolbar";
import { ThreadMessageBody } from "./thread-message-body";
import { ThreadReaderToolbar } from "./thread-reader-toolbar";
import { useMoveToInbox } from "./use-move-to-inbox";
import { useThreadReaderActions } from "./use-thread-reader-actions";

type ThreadQueryResult =
  | FunctionReturnType<typeof api.mail.queries.getThread>
  | undefined;

export function ThreadReaderScreen() {
  const {
    id,
    mailbox: mailboxParam,
    messageId,
  } = useLocalSearchParams<{
    id: string;
    mailbox?: string | string[];
    messageId?: string | string[];
  }>();
  const [departingReader, setDepartingReader] = useState<DepartingReader>();
  const mailbox = parseMobileMailbox(firstParam(mailboxParam));
  const threadId = id ? toConvexId<"threads">(id) : undefined;
  const queryArgs = threadId && !departingReader ? { threadId } : "skip";
  const thread = useQuery(api.mail.queries.getThread, queryArgs);
  const setThreadRead = useMutation(api.mail.mutations.setThreadRead);

  // eslint-disable-next-line no-restricted-syntax -- Direct and notification routes bypass the inbox tap that normally marks a thread read.
  useEffect(() => {
    if (!threadId || !thread || thread.unreadCount === 0) return;
    void setThreadRead({ threadId, isRead: true }).catch(() => undefined);
  }, [setThreadRead, thread, threadId]);

  const isLoading = !departingReader && thread === undefined && !!threadId;
  return (
    <ContentReveal isReady={!isLoading}>
      <ThreadScreenBody
        departingReader={departingReader}
        isLoading={isLoading}
        mailbox={mailbox}
        targetMessageId={firstParam(messageId)}
        thread={thread}
        onPermanentDeleteStart={setDepartingReader}
      />
    </ContentReveal>
  );
}

interface DepartingReader {
  accountAddress: string;
  thread: MailThread;
}

function ThreadScreenBody({
  departingReader,
  isLoading,
  mailbox,
  onPermanentDeleteStart,
  targetMessageId,
  thread,
}: {
  departingReader: DepartingReader | undefined;
  isLoading: boolean;
  mailbox: MobileMailbox;
  onPermanentDeleteStart: (reader: DepartingReader) => void;
  targetMessageId: string | undefined;
  thread: ThreadQueryResult;
}) {
  if (departingReader) {
    return (
      <ThreadReader
        accountAddress={departingReader.accountAddress}
        canMoveToInbox={false}
        mailbox={mailbox}
        targetMessageId={targetMessageId}
        thread={departingReader.thread}
        onPermanentDeleteStart={() => undefined}
      />
    );
  }
  if (isLoading) return null;
  if (!thread) return <ThreadNotFound />;
  const mailThread = toMailThreadDetail(thread);
  return (
    <ThreadReader
      accountAddress={thread.account.address}
      canMoveToInbox={canMoveMailThreadToInbox({
        archivedAt: thread.archivedAt,
        inInbox: thread.inInbox,
        provider: thread.account.provider,
      })}
      mailbox={getReaderMailbox(mailbox, thread)}
      targetMessageId={targetMessageId}
      thread={mailThread}
      onPermanentDeleteStart={() =>
        onPermanentDeleteStart({
          accountAddress: thread.account.address,
          thread: mailThread,
        })
      }
    />
  );
}

/** The toolbar follows where the thread lives, not the list it came from. */
function getReaderMailbox(
  mailbox: MobileMailbox,
  thread: { archivedAt?: number; inInbox?: boolean },
) {
  if (mailbox === "spam") return "spam";
  const placement = getMailThreadPlacement(thread);
  if (placement === "archived") return "archive";
  if (placement === "elsewhere") return "all";
  return "inbox";
}

function ThreadReader({
  accountAddress,
  canMoveToInbox,
  mailbox,
  onPermanentDeleteStart,
  targetMessageId,
  thread,
}: {
  accountAddress: string;
  canMoveToInbox: boolean;
  mailbox: MobileMailbox;
  onPermanentDeleteStart: () => void;
  targetMessageId?: string;
  thread: MailThread;
}) {
  const router = useRouter();
  const moveToInbox = useMoveToInbox();
  const scrollViewRef = useRef<ScrollView>(null);
  const [viewMode, setViewMode] = useState<MessageViewMode>("clean");
  const actions = useThreadReaderActions(thread, onPermanentDeleteStart);
  const activeMessage = getActiveMessage(thread, targetMessageId);
  const cleanViewAction = useCleanViewAction(activeMessage);
  function reply() {
    const latestMessage = thread.messages.at(-1);
    if (!latestMessage) return;
    const address = getReplyAddress(thread.messages, accountAddress);
    if (!address) return;
    router.push({
      pathname: "/compose",
      params: {
        accountId: thread.accountId,
        replyToMessageId: latestMessage.id,
        to: address,
        subject: thread.subject.startsWith("Re:")
          ? thread.subject
          : `Re: ${thread.subject}`,
      },
    });
  }
  return (
    <>
      <ThreadReaderToolbar
        canMoveToInbox={canMoveToInbox}
        cleanViewAction={cleanViewAction}
        isPinned={actions.isPinned}
        mailbox={mailbox}
        title={thread.sender.name}
        onArchive={() => void actions.archive()}
        onDelete={actions.confirmPermanentDelete}
        onMoveToInbox={() => moveToInbox(thread.id)}
        onPin={() => void actions.togglePin()}
        onReply={reply}
        onRestore={() => void actions.restore()}
        onUnsubscribe={() => actions.confirmUnsubscribe(activeMessage)}
        unsubscribeName={activeMessage?.mailingList?.displayName}
      />
      <PostalPaperBackground>
        <ScrollView
          ref={scrollViewRef}
          contentContainerClassName="gap-5 px-4 pt-2 pb-32"
          contentInsetAdjustmentBehavior="automatic"
        >
          <Text
            className="text-foreground text-[22px] leading-7 font-bold"
            selectable
          >
            {thread.subject}
          </Text>
          <MessageViewToolbar
            message={activeMessage}
            onChange={setViewMode}
            value={viewMode}
          />
          <CleanViewCodeCard
            code={activeMessage?.cleanCode}
            viewMode={viewMode}
          />
          {/* react-doctor-disable-next-line react-doctor/rn-no-scrollview-mapped-list -- A thread's messages stay mounted: virtualizing would tear down and reload each message's web view (and its remote images) on scroll, and the jump to a linked message needs every message laid out. */}
          {thread.messages.map((message, index) => (
            <ThreadMessageBody
              key={message.id}
              message={message}
              showSeparator={index > 0}
              viewMode={viewMode}
              onLayout={
                message.id === targetMessageId
                  ? (event) => scrollToMessage(scrollViewRef.current, event)
                  : undefined
              }
            />
          ))}
        </ScrollView>
      </PostalPaperBackground>
    </>
  );
}

function getActiveMessage(thread: MailThread, targetMessageId?: string) {
  if (targetMessageId) {
    const target = thread.messages.find(
      (message) => message.id === targetMessageId,
    );
    if (target) return target;
  }
  return thread.messages.at(-1);
}

function useCleanViewAction(message: MailMessage | undefined) {
  const generate = useMutation(
    api.cleanView.mutations.generate,
  ).withOptimisticUpdate(optimisticallyGenerateCleanView);
  if (!message) return;
  const messageId = toConvexId<"messages">(message.id);
  return {
    disabled: isPreparingCleanView(message),
    label: hasGeneratedCleanView(message)
      ? "Regenerate Clean View"
      : "Generate Clean View",
    onPress: () =>
      void generate({ messageId }).catch(() =>
        Alert.alert("Couldn’t prepare a clean version", "Please try again."),
      ),
  } satisfies CleanViewMenuAction;
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function scrollToMessage(
  scrollView: ScrollView | null,
  event: LayoutChangeEvent,
) {
  const y = Math.max(0, event.nativeEvent.layout.y - 16);
  requestAnimationFrame(() => scrollView?.scrollTo({ animated: false, y }));
}

function ThreadNotFound() {
  return (
    <View className="bg-background flex-1 items-center justify-center px-8">
      <Text className="text-foreground text-lg font-bold">
        Message unavailable
      </Text>
      <Text className="text-muted-foreground mt-2 text-center">
        This thread is no longer in the local mailbox.
      </Text>
    </View>
  );
}
