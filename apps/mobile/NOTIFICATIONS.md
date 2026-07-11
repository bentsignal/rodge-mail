# Mobile new-mail notifications

Rodge Mail registers an Expo push token after an authenticated user grants
notification permission. iOS and Android devices store an installation ID in
SecureStore and register the Expo token with the authenticated Convex owner.
Background registration refreshes an already granted token but never opens the
system permission prompt; only an explicit settings or preview action requests
permission. Token rotation replaces the previous token for that owner and
installation. Simulator registration intentionally stops after permission
setup because iOS Simulator cannot receive remote push notifications.

For simulator acceptance, call
`scheduleLocalNotificationPreview()` from the development console or a
temporary development control. The local notification uses the same payload
shape and response listener as remote mail notifications. Tapping it targets
the canonical `/(tabs)/(inbox)/thread/[id]` route. A placeholder thread ID will
open the route and show its normal missing-message state; use a real thread ID
to verify the full reader flow.

Remote delivery requires a fresh native development-client build after adding
`expo-notifications`. For iOS device builds, configure the APNs key/certificate
for the EAS project and ensure the provisioning profile includes the `aps-environment`
entitlement. For Android, configure the Firebase Cloud Messaging service
account/API key in EAS. No provider credential is required to run local
notifications in Simulator.

Convex creates one staged delivery record per newly inserted incoming inbox
message only during incremental sync and only when the provider timestamp is
within the last 24 hours. Initial imports, full repair/reconciliation runs,
manual syncs, backfills, and historical messages discovered incrementally do
not notify. Classification advances only mail meeting the shared normalized
importance threshold to Expo delivery. The delivery is claimed before the Expo
request, preventing sync retries from duplicating a send. Push tickets and
bounded receipt polling distinguish Expo acceptance from device delivery, and
`DeviceNotRegistered` tokens are disabled automatically.
