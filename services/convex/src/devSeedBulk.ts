import type { DemoMessage } from "./devSeedFixtures";
import { ISOLATED_OWNER_NAME } from "./devSeedMailbox";

export const MAX_BULK_THREADS = 400;

const ACCOUNTS = ["gmail", "microsoft", "icloud"] as const;

const CATEGORIES = [
  "personal",
  "newsletter",
  "notification",
  "transactional",
] as const;

type Pair = readonly [string, string];

const SENDERS = [
  ["Jordan Park", "jordan@northwind.example"],
  ["Priya Natarajan", "priya@studio.example"],
  ["City Library", "notices@library.example"],
  ["Trailhead Weekly", "news@trailhead.example"],
  ["Sam Okafor", "sam@example.org"],
  ["Lumen Bank", "alerts@lumen.example"],
  ["Riverside Clinic", "appointments@clinic.example"],
  ["Casey Morgan", "casey@example.net"],
] as const;

const SUBJECTS = [
  ["Notes from Thursday", "Here's what we agreed on and who owns each item."],
  ["Your statement is ready", "Your monthly statement is available to view."],
  ["Weekend plans?", "Are you around Saturday? We're thinking of a hike."],
  ["Reminder: appointment", "This is a reminder of your upcoming visit."],
  ["Draft for review", "I've attached the latest draft. Comments welcome."],
  ["This week's reading list", "Five long reads we enjoyed this week."],
] as const;

/**
 * Older filler threads for `scripts/backend.sh seed <count>`, so an isolated
 * inbox pages several times. They sit after the regular seed, one every six
 * hours, and spread across the connected accounts.
 */
export function bulkMailbox(now: number, count: number) {
  const total = Math.min(Math.max(Math.floor(count), 0), MAX_BULK_THREADS);
  return Array.from({ length: total }, (_, index): DemoMessage => {
    const id = `isolated-bulk-${index}`;
    const [name, address] = cycle<Pair>(SENDERS, index);
    const [subject, snippet] = cycle<Pair>(SUBJECTS, index);
    return {
      account: cycle(ACCOUNTS, index),
      remoteMessageId: id,
      remoteThreadId: `isolated-bulk-thread-${index}`,
      internetMessageId: `<${id}@seed.example>`,
      from: { address, name },
      subject: `${subject} #${index + 1}`,
      snippet,
      body: `${snippet}\n\n${name}`,
      receivedAt: Math.round(now - (200 + index * 6) * 60 * 60 * 1000),
      isRead: index % 5 !== 0,
      isPinned: false,
      category: cycle(CATEGORIES, index),
      importance: 0.4,
      confidence: 0.9,
      reason: "Seeded demo mail.",
      summary: snippet,
      shouldEmbed: false,
      recipientName: ISOLATED_OWNER_NAME,
    };
  });
}

function cycle<T>(items: readonly [T, ...T[]], index: number) {
  return items[index % items.length] ?? items[0];
}
