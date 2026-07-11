import { formatRelativeTime } from "@rodge-mail/std/relative-time";

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function formatInboxDate(isoDate: string, now = Date.now()) {
  return formatRelativeTime(new Date(isoDate).getTime(), now);
}

export function formatFullDate(isoDate: string) {
  return FULL_DATE_FORMATTER.format(new Date(isoDate));
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toLocaleUpperCase();
}
