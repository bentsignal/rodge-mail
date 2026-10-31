import { useState } from "react";
import * as Haptics from "expo-haptics";
import { useMutation } from "convex/react";
import { createStore } from "rostra";

import type { Id } from "@rodge-mail/convex/model";
import { api } from "@rodge-mail/convex/api";

import type { EnqueueArgs } from "./outbox-optimistic";
import type { OutgoingSendState } from "./outgoing-status";
import { addQueuedOutboxRow, markOutboxQueued } from "./outbox-optimistic";

export interface OutgoingSend extends OutgoingSendState {
  args: EnqueueArgs;
  key: string;
  outboxId?: Id<"outboxMessages">;
}

/**
 * Sends outlive the composer: it closes the moment Send is tapped, and the
 * enqueue, its result, and any retry run here.
 */
function useInternalStore() {
  const [sends, setSends] = useState<OutgoingSend[]>([]);
  const enqueue = useMutation(
    api.mail.mutations.enqueuePlainText,
  ).withOptimisticUpdate(addQueuedOutboxRow);
  const retryOutbox = useMutation(
    api.mail.mutations.retryOutbox,
  ).withOptimisticUpdate(markOutboxQueued);

  function update(key: string, patch: Partial<OutgoingSend>) {
    setSends((current) =>
      current.map((send) => (send.key === key ? { ...send, ...patch } : send)),
    );
  }

  function run(send: OutgoingSend) {
    enqueue(send.args)
      .then((result) => {
        update(send.key, {
          error: undefined,
          outboxId: result.outboxId,
          phase: "queued",
        });
      })
      .catch((error: unknown) => {
        update(send.key, { error: getErrorMessage(error), phase: "failed" });
        notify(Haptics.NotificationFeedbackType.Error);
      });
  }

  function send(args: EnqueueArgs) {
    const next = {
      args,
      key: args.idempotencyKey,
      phase: "enqueuing",
      subject: args.subject,
    } satisfies OutgoingSend;
    setSends((current) => [
      ...current.filter((item) => item.key !== next.key),
      next,
    ]);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    run(next);
  }

  function retry(key: string) {
    const target = sends.find((item) => item.key === key);
    if (!target) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    if (target.outboxId) {
      retryOutbox({ outboxId: target.outboxId }).catch(() => {
        notify(Haptics.NotificationFeedbackType.Error);
      });
      return;
    }
    update(key, { error: undefined, phase: "enqueuing" });
    run(target);
  }

  function retryOutboxMessage(outboxId: Id<"outboxMessages">) {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
      () => undefined,
    );
    retryOutbox({ outboxId }).catch(() => {
      notify(Haptics.NotificationFeedbackType.Error);
    });
  }

  function dismiss(key: string) {
    setSends((current) => current.filter((item) => item.key !== key));
  }

  return { dismiss, retry, retryOutboxMessage, send, sends };
}

function notify(type: Haptics.NotificationFeedbackType) {
  void Haptics.notificationAsync(type).catch(() => undefined);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Rodge Mail couldn’t queue this message.";
}

export const { Store: OutgoingMailStore, useStore: useOutgoingMail } =
  createStore(useInternalStore);
