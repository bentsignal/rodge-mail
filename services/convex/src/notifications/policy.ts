const NEW_MAIL_FRESHNESS_MS = 24 * 60 * 60 * 1000;

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
    args.receivedAt <= args.now + 5 * 60 * 1000
  );
}
