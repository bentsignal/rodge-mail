import { useEffect } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Animated, { FadeInDown, FadeOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import { AlertCircle, Check, RotateCcw, X } from "lucide-react-native";

import { api } from "@rodge-mail/convex/api";
import { getSentSubject } from "@rodge-mail/features/mail";

import type { OutgoingBannerState } from "./outgoing-status";
import { useColor } from "~/hooks/use-color";
import { useMailStore } from "../store";
import { getOutgoingBannerState } from "./outgoing-status";
import { useOutgoingMail } from "./outgoing-store";

const TAB_BAR_CLEARANCE = 62;
const SENT_CONFIRMATION_MS = 2200;

/** A small status pill above the tab bar while the latest send is in flight. */
export function OutgoingMailBanner() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const sends = useOutgoingMail((store) => store.sends);
  const dismiss = useOutgoingMail((store) => store.dismiss);
  const retry = useOutgoingMail((store) => store.retry);
  const setAccountFilter = useMailStore((store) => store.setAccountFilter);
  const setMailbox = useMailStore((store) => store.setMailbox);
  const latest = sends.at(-1);
  const outbox = useQuery(api.outbox.queries.listRecent, latest ? {} : "skip");
  const state = getOutgoingBannerState(latest, outbox);
  const latestKey = latest?.key;
  const isSent = state?.kind === "sent";

  // eslint-disable-next-line no-restricted-syntax -- The confirmation hides itself a moment after the live outbox reports delivery; no user event marks that moment.
  useEffect(() => {
    if (!isSent || !latestKey) return;
    const timeout = setTimeout(() => dismiss(latestKey), SENT_CONFIRMATION_MS);
    return () => clearTimeout(timeout);
  }, [dismiss, isSent, latestKey]);

  if (!latest || !state) return null;
  return (
    <View
      pointerEvents="box-none"
      style={{
        bottom: insets.bottom + TAB_BAR_CLEARANCE,
        left: 0,
        position: "absolute",
        right: 0,
      }}
    >
      <Animated.View
        key={`${latest.key}:${state.kind}`}
        entering={FadeInDown.duration(220)}
        exiting={FadeOutDown.duration(160)}
        className="items-center px-6"
        pointerEvents="box-none"
      >
        <BannerPill
          state={state}
          subject={getSentSubject(latest.subject)}
          onDismiss={() => dismiss(latest.key)}
          onOpen={() => {
            if (state.outboxId) {
              router.push(`/(tabs)/(inbox)/sent/${state.outboxId}`);
              return;
            }
            setAccountFilter("all");
            setMailbox("sent");
            router.navigate("/(tabs)/(inbox)");
          }}
          onRetry={() => retry(latest.key)}
        />
      </Animated.View>
    </View>
  );
}

function BannerPill({
  onDismiss,
  onOpen,
  onRetry,
  state,
  subject,
}: {
  onDismiss: () => void;
  onOpen: () => void;
  onRetry: () => void;
  state: OutgoingBannerState;
  subject: string;
}) {
  const card = useColor("popover");
  const border = useColor("border");
  return (
    <View
      className="max-w-full flex-row items-center gap-1 rounded-full py-1 pr-1 pl-3.5"
      style={{
        backgroundColor: card,
        borderColor: border,
        borderWidth: 0.5,
        boxShadow: "0 6px 20px rgba(0, 0, 0, 0.12)",
      }}
      testID="outgoing-mail-banner"
    >
      <Pressable
        accessibilityHint="Opens the message in Sent"
        accessibilityLabel={`${state.message} ${subject}`}
        accessibilityRole="button"
        className="min-h-9 min-w-0 shrink flex-row items-center gap-2 pr-2"
        onPress={onOpen}
      >
        <BannerIcon kind={state.kind} />
        <Text
          className={
            state.kind === "failed"
              ? "text-destructive text-[15px] font-semibold"
              : "text-foreground text-[15px] font-semibold"
          }
        >
          {state.message}
        </Text>
        <Text
          className="text-muted-foreground min-w-0 shrink text-[15px]"
          numberOfLines={1}
        >
          {subject}
        </Text>
      </Pressable>
      <BannerActions
        kind={state.kind}
        onDismiss={onDismiss}
        onRetry={onRetry}
      />
    </View>
  );
}

function BannerActions({
  kind,
  onDismiss,
  onRetry,
}: {
  kind: OutgoingBannerState["kind"];
  onDismiss: () => void;
  onRetry: () => void;
}) {
  const foreground = useColor("foreground");
  const mutedForeground = useColor("muted-foreground");
  if (kind !== "failed") return <View className="w-2" />;
  return (
    <>
      <Pressable
        accessibilityLabel="Retry sending"
        accessibilityRole="button"
        className="bg-muted h-8 flex-row items-center gap-1.5 rounded-full px-3"
        hitSlop={6}
        onPress={onRetry}
      >
        <RotateCcw color={foreground} size={14} />
        <Text className="text-foreground text-sm font-semibold">Retry</Text>
      </Pressable>
      <Pressable
        accessibilityLabel="Dismiss"
        accessibilityRole="button"
        className="size-8 items-center justify-center"
        hitSlop={6}
        onPress={onDismiss}
      >
        <X color={mutedForeground} size={16} />
      </Pressable>
    </>
  );
}

function BannerIcon({ kind }: { kind: OutgoingBannerState["kind"] }) {
  const foreground = useColor("foreground");
  const destructive = useColor("destructive");
  if (kind === "sending") return <ActivityIndicator size="small" />;
  if (kind === "failed") return <AlertCircle color={destructive} size={17} />;
  return <Check color={foreground} size={17} strokeWidth={2.5} />;
}
