import type { MailAccount, MailThread } from "./types";

export const DEMO_MAIL_ACCOUNTS = [
  {
    id: "gmail",
    label: "Personal",
    address: "shawn@gmail.com",
    provider: "gmail",
    initials: "SG",
    accent: "#c95d3f",
  },
  {
    id: "work",
    label: "Work",
    address: "shawn@bentsignal.com",
    provider: "microsoft",
    initials: "BS",
    accent: "#397367",
  },
  {
    id: "icloud",
    label: "iCloud",
    address: "shawn@icloud.com",
    provider: "icloud",
    initials: "SI",
    accent: "#b38736",
  },
] satisfies MailAccount[];

export const DEMO_MAIL_THREADS = [
  {
    id: "weekend-cabin",
    accountId: "gmail",
    subject: "Cabin details for this weekend",
    sender: { name: "Maya Chen", address: "maya.chen@example.com" },
    preview:
      "I left the key code and the trail map below. The lake should be quiet by the time you arrive.",
    receivedAt: "2026-07-09T14:42:00.000Z",
    isRead: false,
    isPinned: true,
    messages: [
      {
        id: "weekend-cabin-1",
        from: { name: "Maya Chen", address: "maya.chen@example.com" },
        to: [{ name: "Shawn", address: "shawn@gmail.com" }],
        cc: [],
        sentAt: "2026-07-09T14:42:00.000Z",
        attachments: [
          {
            id: "cabin-map",
            name: "north-trail-map.pdf",
            size: "2.4 MB",
            status: "remote",
            type: "document",
          },
        ],
        body: [
          "Hey Shawn,",
          "I left the key code in the shared note and attached the trail map we used last summer. The lake should be quiet by the time you arrive Friday evening.",
          "There is coffee in the blue tin. If you get in after dark, the porch light switch is just inside the mudroom—not by the front door where you would expect it.",
          "Have a good weekend. Send me one photo if the fog rolls in.",
          "Maya",
        ],
      },
    ],
  },
  {
    id: "railway-launch",
    accountId: "work",
    subject: "Railway launch — final decisions",
    sender: { name: "Noah Williams", address: "noah@bentsignal.com" },
    preview:
      "We have two open decisions before the afternoon review: the migration window and who owns rollback.",
    receivedAt: "2026-07-09T13:18:00.000Z",
    isRead: false,
    isPinned: true,
    messages: [
      {
        id: "railway-launch-1",
        from: { name: "Noah Williams", address: "noah@bentsignal.com" },
        to: [{ name: "Shawn", address: "shawn@bentsignal.com" }],
        cc: [{ name: "Inez Park", address: "inez@bentsignal.com" }],
        sentAt: "2026-07-09T13:18:00.000Z",
        attachments: [],
        body: [
          "Morning,",
          "We have two open decisions before the afternoon review: the migration window and who owns rollback. My vote is the 06:00 UTC window with me on rollback and Inez on comms.",
          "If you agree, reply with a quick yes and I will update the launch brief before 15:00.",
          "Noah",
        ],
      },
    ],
  },
  {
    id: "order-shipped",
    accountId: "gmail",
    subject: "Your Field Notes order has shipped",
    sender: { name: "Field Notes", address: "dispatch@fieldnotesbrand.com" },
    preview:
      "Package 1Z84A9 is moving and is expected Monday. Track the shipment or view your receipt.",
    receivedAt: "2026-07-09T11:05:00.000Z",
    isRead: true,
    isPinned: false,
    messages: [
      {
        id: "order-shipped-1",
        from: {
          name: "Field Notes",
          address: "dispatch@fieldnotesbrand.com",
        },
        to: [{ name: "Shawn", address: "shawn@gmail.com" }],
        cc: [],
        sentAt: "2026-07-09T11:05:00.000Z",
        attachments: [],
        body: [
          "Good news—your order is on the way.",
          "Package 1Z84A9 is moving and is expected Monday, July 13. The parcel contains one Pitch Black Memo Book 3-Pack and one No. 2 Woodgrain Pencil 6-Pack.",
          "We will send another note when it is out for delivery.",
        ],
      },
    ],
  },
  {
    id: "mom-dinner",
    accountId: "icloud",
    subject: "Sunday dinner",
    sender: { name: "Mom", address: "mom@example.com" },
    preview:
      "Can you make it around five? Your sister is bringing the peach pie and I am making too much food.",
    receivedAt: "2026-07-08T22:31:00.000Z",
    isRead: false,
    isPinned: false,
    messages: [
      {
        id: "mom-dinner-1",
        from: { name: "Mom", address: "mom@example.com" },
        to: [{ name: "Shawn", address: "shawn@icloud.com" }],
        cc: [],
        sentAt: "2026-07-08T22:31:00.000Z",
        attachments: [],
        body: [
          "Can you make it around five on Sunday? Your sister is bringing the peach pie and I am making too much food, as usual.",
          "No need to bring anything. Just let me know so I can stop worrying about whether I bought enough corn.",
          "Love you.",
        ],
      },
    ],
  },
  {
    id: "lease-renewal",
    accountId: "gmail",
    subject: "Lease renewal document ready",
    sender: { name: "Harbor Property", address: "leasing@harborproperty.com" },
    preview:
      "Your renewal offer is ready to review. The current terms remain available through July 21.",
    receivedAt: "2026-07-08T16:20:00.000Z",
    isRead: true,
    isPinned: false,
    messages: [
      {
        id: "lease-renewal-1",
        from: {
          name: "Harbor Property",
          address: "leasing@harborproperty.com",
        },
        to: [{ name: "Shawn", address: "shawn@gmail.com" }],
        cc: [],
        sentAt: "2026-07-08T16:20:00.000Z",
        attachments: [
          {
            id: "lease-summary",
            name: "renewal-summary.pdf",
            size: "184 KB",
            status: "remote",
            type: "document",
          },
        ],
        body: [
          "Hello Shawn,",
          "Your renewal offer is ready to review. The current terms remain available through July 21. A summary is attached; the complete agreement is available in the resident portal.",
          "Please reply if you would like to discuss a different term length.",
          "Harbor Property Management",
        ],
      },
    ],
  },
  {
    id: "privacy-update",
    accountId: "work",
    subject: "We updated our privacy policy",
    sender: { name: "Cloudboard", address: "updates@cloudboard.example" },
    preview:
      "We clarified how analytics data is retained. No action is required and your settings remain unchanged.",
    receivedAt: "2026-07-09T12:06:00.000Z",
    isRead: false,
    isPinned: false,
    messages: [
      {
        id: "privacy-update-1",
        from: { name: "Cloudboard", address: "updates@cloudboard.example" },
        to: [{ name: "Shawn", address: "shawn@bentsignal.com" }],
        cc: [],
        sentAt: "2026-07-09T12:06:00.000Z",
        attachments: [],
        body: [
          "We updated our privacy policy to clarify how analytics data is retained and how subprocessors are listed.",
          "No action is required and your settings remain unchanged.",
        ],
      },
    ],
  },
  {
    id: "weekly-roundup",
    accountId: "gmail",
    subject: "This week in independent publishing",
    sender: { name: "The Colophon", address: "dispatch@colophon.example" },
    preview:
      "A small press revives a forgotten typeface, three summer reading lists, and notes from the bindery.",
    receivedAt: "2026-07-09T09:12:00.000Z",
    isRead: true,
    isPinned: false,
    messages: [
      {
        id: "weekly-roundup-1",
        from: { name: "The Colophon", address: "dispatch@colophon.example" },
        to: [{ name: "Shawn", address: "shawn@gmail.com" }],
        cc: [],
        sentAt: "2026-07-09T09:12:00.000Z",
        attachments: [],
        body: [
          "This week: a small press revives a forgotten typeface, three summer reading lists worth keeping, and notes from a family-run bindery in Maine.",
          "Read the complete issue in your browser whenever you have a quiet ten minutes.",
        ],
      },
    ],
  },
  {
    id: "product-digest",
    accountId: "work",
    subject: "Your Tuesday product digest",
    sender: { name: "Linear", address: "digest@linear.example" },
    preview:
      "Eight issues closed, three projects updated, and two documents shared with your workspace.",
    receivedAt: "2026-07-08T14:00:00.000Z",
    isRead: true,
    isPinned: false,
    messages: [
      {
        id: "product-digest-1",
        from: { name: "Linear", address: "digest@linear.example" },
        to: [{ name: "Shawn", address: "shawn@bentsignal.com" }],
        cc: [],
        sentAt: "2026-07-08T14:00:00.000Z",
        attachments: [],
        body: [
          "Eight issues closed, three projects updated, and two documents shared with your workspace since the last digest.",
          "Open Linear to review the complete activity report.",
        ],
      },
    ],
  },
] satisfies MailThread[];
