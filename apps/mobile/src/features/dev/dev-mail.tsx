import { useEffect } from "react";

import { useMailStore } from "~/features/mail/store";
import { setDevMailActions } from "./dev-mail-actions";

/**
 * Debug builds only: lets `scripts/sim.sh eval` pin, archive, and mark read
 * the inbox's rows by index, so `frames` measures the app's own motion
 * without a synthesized swipe on the UI thread.
 */
export function DevMailBridge() {
  const threads = useMailStore((store) => store.threads);
  const archiveThread = useMailStore((store) => store.archiveThread);
  const togglePin = useMailStore((store) => store.togglePin);
  const toggleRead = useMailStore((store) => store.toggleRead);
  const setSelectionMode = useMailStore((store) => store.setSelectionMode);

  // eslint-disable-next-line no-restricted-syntax -- Hands the latest store actions to the debugger hook, which runs outside React.
  useEffect(() => {
    if (!__DEV__) return;
    setDevMailActions({
      archive: (index) => {
        const thread = threads[index];
        if (thread) void archiveThread(thread.id);
      },
      pin: (index) => {
        const thread = threads[index];
        if (thread) void togglePin(thread.id, thread.isPinned);
      },
      read: (index) => {
        const thread = threads[index];
        if (thread) void toggleRead(thread.id, thread.isRead);
      },
      select: () => setSelectionMode((selecting) => !selecting),
    });
  });
  return null;
}
