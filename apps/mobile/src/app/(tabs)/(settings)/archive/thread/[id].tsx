import { ThreadReaderScreen } from "~/features/mail/screens/thread-reader-screen";

export default function ArchivedThreadRoute() {
  return <ThreadReaderScreen mailbox="archive" />;
}
