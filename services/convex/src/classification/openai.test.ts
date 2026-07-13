import { describe, expect, it } from "vitest";

import {
  classificationRequest,
  parseClassification,
  parseCleanView,
} from "./openai";

const classification = {
  schemaVersion: "classification-v4",
  category: "action_required",
  importance: 0.92,
  confidence: 0.88,
  reason: "A reply is requested before a deadline.",
  isSpam: false,
};

describe("classification model output", () => {
  it("reserves visible structured output beyond minimal reasoning", () => {
    expect(
      classificationRequest(
        {
          direction: "incoming",
          from: { address: "person@example.com" },
          to: [{ address: "owner@example.com" }],
          cc: [],
          subject: "Hello",
          snippet: "Checking in",
          body: "",
          headers: [],
          hasAttachments: false,
          isPinned: false,
          bodyWasTruncated: false,
        },
        [],
      ),
    ).toMatchObject({
      max_output_tokens: 1_000,
      reasoning: { effort: "minimal" },
    });
  });

  it("accepts scalar importance without an inbox bucket", () => {
    expect(parseClassification(JSON.stringify(classification))).toEqual(
      classification,
    );
  });

  it("does not propagate a legacy bucket from model output", () => {
    expect(
      parseClassification(
        JSON.stringify({ ...classification, bucket: "focused" }),
      ),
    ).not.toHaveProperty("bucket");
  });

  it.each(["category", "importance", "reason", "isSpam"])(
    "rejects output missing %s",
    (field) => {
      const incomplete = Object.fromEntries(
        Object.entries(classification).filter(([key]) => key !== field),
      );
      expect(() => parseClassification(JSON.stringify(incomplete))).toThrow(
        "Model returned an invalid classification",
      );
    },
  );
});

describe("clean view model output", () => {
  it("validates summary and cleaned markdown independently", () => {
    expect(
      parseCleanView(
        JSON.stringify({
          schemaVersion: "clean-view-v1",
          summary: "Review and reply before Friday.",
          cleanedMarkdown:
            "Please review the proposal and reply before Friday.",
        }),
      ),
    ).toMatchObject({
      summary: "Review and reply before Friday.",
      cleanedMarkdown: "Please review the proposal and reply before Friday.",
    });
  });
});
