import type { ISOLATED_ACCOUNTS } from "./devSeedMailbox";

/** Sent mail for the isolated backend: delivered, queued, and failed. */
type AccountKey = (typeof ISOLATED_ACCOUNTS)[number]["key"];

export interface SentSeed {
  account: AccountKey;
  to: [name: string, address: string][];
  cc?: [name: string, address: string][];
  subject: string;
  body: string;
  hoursAgo: number;
  status: "failed" | "pending" | "sending" | "sent";
  /** Whether the provider's copy has synced into the mailbox. */
  stored?: boolean;
  /** Reply in the seeded inbox thread with this remote id. */
  thread?: string;
  attachment?: { fileName: string; contentType: string; size: number };
  error?: string;
}

export const SENT_SEEDS = [
  {
    account: "gmail",
    to: [["Maya Chen", "maya@northwind.example"]],
    cc: [["Priya Patel", "priya@northwind.example"]],
    subject: "Notes from today's call",
    body: "Hi Maya,\n\nHere are the notes from today's call. The short version: we ship the beta on the 14th and keep the old importer for another month.\n\nAlex",
    hoursAgo: 0.02,
    status: "pending",
  },
  {
    account: "microsoft",
    to: [["Finance Team", "finance@northwind.example"]],
    subject: "Quarterly numbers",
    body: "Attached are the quarterly numbers we discussed. Let me know if anything looks off.\n\nAlex",
    hoursAgo: 1.2,
    status: "failed",
    error: "Microsoft 365 rejected the message: the connection needs to be renewed.",
    attachment: {
      fileName: "q3-numbers.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 48_213,
    },
  },
  {
    account: "microsoft",
    to: [["Maya Chen", "maya@northwind.example"]],
    subject: "Re: Can we move tomorrow's review?",
    body: "11 works for me. I'll move the invite and let the team know.\n\nAlex",
    hoursAgo: 0.1,
    status: "sent",
    stored: true,
    thread: "isolated-thread-0",
  },
  {
    account: "gmail",
    to: [
      ["Jordan Blake", "jordan@example.org"],
      ["Sam Ortiz", "sam@example.org"],
    ],
    cc: [["Riley Park", "riley@example.org"]],
    subject: "Weekend hike?",
    body: "Anyone up for the ridge trail on Saturday? I attached the map. We'd leave at 8 and be back by 2.\n\nAlex",
    hoursAgo: 3,
    status: "sent",
    stored: true,
    attachment: {
      fileName: "ridge-trail-map.pdf",
      contentType: "application/pdf",
      size: 812_455,
    },
  },
  {
    account: "hosted",
    to: [["Accounts Payable", "billing@client.example"]],
    subject: "Invoice #204",
    body: "Hello,\n\nPlease find invoice #204 for October attached. Payment is due within 30 days.\n\nThank you,\nAlex Rivera",
    hoursAgo: 26,
    status: "sent",
    attachment: {
      fileName: "invoice-204.pdf",
      contentType: "application/pdf",
      size: 96_520,
    },
  },
  {
    account: "icloud",
    to: [
      ["Casey Rivera", "casey@example.net"],
      ["Morgan Lee", "morgan@studio.example"],
    ],
    subject: "Dinner on Friday",
    body: "Booked a table for four at 7:30 on Friday. See you there!\n\nAlex",
    hoursAgo: 50,
    status: "sent",
    stored: true,
  },
] satisfies SentSeed[];

