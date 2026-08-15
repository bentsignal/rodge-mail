import type { SilentMailNotificationAction } from "./notification-actions";

interface NotificationQuickActionRequest {
  action: SilentMailNotificationAction;
  deliveryId: string;
  token: string;
  url: string;
}

export function getNotificationQuickActionRequest(
  action: SilentMailNotificationAction,
  data: Record<string, unknown>,
) {
  const deliveryId = data.quickActionDeliveryId;
  const token = data.quickActionToken;
  const url = data.quickActionUrl;
  if (
    typeof deliveryId !== "string" ||
    typeof token !== "string" ||
    typeof url !== "string" ||
    deliveryId.length === 0 ||
    token.length === 0 ||
    !isSecureUrl(url)
  ) {
    return undefined;
  }
  return { action, deliveryId, token, url };
}

export async function performNotificationQuickAction(
  request: NotificationQuickActionRequest,
  requestFetch: typeof fetch = fetch,
) {
  const response = await requestFetch(request.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      action: request.action,
      deliveryId: request.deliveryId,
      token: request.token,
    }),
  });
  return response.ok;
}

function isSecureUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
