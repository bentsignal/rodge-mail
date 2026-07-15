# Overnight authenticated Electron interaction sweep

Date: 2026-07-11 (America/New_York)

Environment:

- Electron development app launched with `pnpm --filter @rodge-mail/desktop dev`
- Authenticated local web origin at `https://www.rodge-mail.local`
- Three connected accounts: Gmail, iCloud, and Microsoft 365
- Desktop window exercised at approximately 1170 × 768 in system dark mode

## Results

| Area | Result | Evidence |
| --- | --- | --- |
| Mailbox switching | Pass | Repeated Unified → Gmail → iCloud → Microsoft 365 → Unified twice. Each account produced its expected `?mailbox=<id>` URL and returned to `/` for Unified. Lists and readers settled without stale account data. |
| Message opening | Pass | Opened messages from iCloud and Gmail through the list, then opened a separate Gmail message through a `rodge-mail://messages/<id>` deep link. Reader headings and bodies matched each selected target. |
| Reload | Pass | Reloaded an open message with Cmd-R. Authentication, route, list, reader selection, and message body were preserved. |
| Deep links | Pass | `open rodge-mail://messages/js7ddbw4ts1ww4zwc3yxh7jsvn8abrat` focused the existing instance and navigated to the requested message. |
| Pinning | Pass | Pinned and then unpinned the open Gmail attachment message. The reader action changed from `Pin message` to `Unpin message`, then returned to `Pin message` after the server update settled. |
| Context menu | Pass | Right-clicking a message exposed only `Pin message` and `Remove from Rodge`; the menu dismissed cleanly without invoking either action. |
| Pagination | Pass | Scrolling the message list loaded successive pages. The visible count advanced from 30 to 60 and then 90 messages while the reader remained usable. |
| Search and debounce | Pass | Search for deployment-related messages returned matching results. Rapidly replacing `Ama` with `Amazon` produced only the final Amazon result set. Clearing search restored the normal 30-message page. |
| Composer | Pass | New message opened as a sized desktop modal with visible From, To, Cc, Bcc, Subject, body, attachment, and disabled Send controls. The From selector listed Gmail, iCloud, and Microsoft 365. Closed without editing or sending. |
| Settings | Pass | Settings opened in a scrollable modal. Account/key sections remained reachable at the tested window size. No credential or account mutations were performed. |
| Theme switching | Pass | Switched System → Light → Dark → System. Selection state and app colors updated each time; light and dark layouts remained legible and aligned. Restored System before closing settings. |
| Sync | Pass | Triggered Sync all accounts. The request completed without an error toast, account error state, renderer exception, or navigation disruption. |
| Renderer/runtime logs | Pass | No renderer or application errors appeared during the sweep. The only terminal message was a macOS Electron `NSSoftLinking` notice about a private HIToolbox symbol. |

## Navigation note

The desktop app has no Back command in its View menu, and the common Alt-Left and Cmd-[ attempts did not navigate. This is not currently blocking because the three-pane desktop UI keeps the inbox list available while reading a message, mailbox buttons return directly to list contexts, reload works, and deep links work. If browser-style history navigation is intended as a product requirement, it should be added and covered explicitly rather than treated as a warm-paper layout regression.

## Safety

- No mail was sent, replied to, marked unread, removed, or deleted.
- The pin mutation was reversed.
- The composer was closed untouched.
- The original System appearance preference was restored.

## Conclusion

No clear functional or interaction regression caused by the recent desktop layout work was found. The current authenticated Electron experience is usable across the requested interaction surface, so this sweep intentionally makes no production-code changes.
