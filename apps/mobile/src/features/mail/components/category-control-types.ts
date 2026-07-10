import type { InboxCategory } from "@rodge-mail/features/mail";

export interface CategoryControlProps {
  onChange: (category: InboxCategory) => void;
  value: InboxCategory;
}
