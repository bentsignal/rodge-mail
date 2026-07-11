export const MOBILE_THREAD_ROUTE = "/(tabs)/(inbox)/thread/[id]";

export function getNotificationTarget(
  data: Record<string, unknown> | undefined,
) {
  if (
    data?.route !== MOBILE_THREAD_ROUTE ||
    typeof data.messageId !== "string" ||
    typeof data.threadId !== "string"
  ) {
    return undefined;
  }
  return { messageId: data.messageId, threadId: data.threadId };
}

export function createNotificationResponseResolver() {
  let handledResponseId: string | undefined;

  return (responseId: string, data: Record<string, unknown> | undefined) => {
    const target = getNotificationTarget(data);
    if (!target || responseId === handledResponseId) return undefined;
    handledResponseId = responseId;
    return target;
  };
}
