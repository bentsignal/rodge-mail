const TIME_FORMATTER = new Intl.DateTimeFormat("en", {
  hour: "numeric",
  minute: "2-digit",
});

const DAY_FORMATTER = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
});

const FULL_DATE_FORMATTER = new Intl.DateTimeFormat("en", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const DEMO_TODAY = "2026-07-09";

export function formatInboxDate(isoDate: string) {
  const date = new Date(isoDate);
  if (isoDate.startsWith(DEMO_TODAY)) return TIME_FORMATTER.format(date);
  return DAY_FORMATTER.format(date);
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
