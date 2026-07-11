const NEW_MAIL_FRESHNESS_MS = 24 * 60 * 60 * 1000;
const FUTURE_TOLERANCE_MS = 5 * 60 * 1000;

export function shouldNotifyForProviderMessage(args: {
  fullSync: boolean;
  reason: string;
  receivedAt: number;
  now: number;
}) {
  return (
    !args.fullSync &&
    args.reason === "incremental" &&
    args.receivedAt >= args.now - NEW_MAIL_FRESHNESS_MS &&
    args.receivedAt <= args.now + FUTURE_TOLERANCE_MS
  );
}

export function isNotificationDeliveryFresh(args: {
  deliveryCreatedAt: number;
  messageReceivedAt: number;
  now: number;
}) {
  return (
    args.deliveryCreatedAt >= args.now - NEW_MAIL_FRESHNESS_MS &&
    args.deliveryCreatedAt <= args.now + FUTURE_TOLERANCE_MS &&
    args.messageReceivedAt >= args.now - NEW_MAIL_FRESHNESS_MS &&
    args.messageReceivedAt <= args.now + FUTURE_TOLERANCE_MS
  );
}
