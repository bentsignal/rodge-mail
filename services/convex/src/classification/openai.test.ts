import { describe, expect, it } from "vitest";

import { classificationRequest, parseClassification } from "./openai";

const classification = {
  schemaVersion: "classification-v2",
  category: "action_required",
  importance: 0.92,
  confidence: 0.88,
  reason: "A reply is requested before a deadline.",
  summary: "Review and reply before Friday.",
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
      max_output_tokens: 1_200,
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

  it.each(["category", "importance", "reason", "summary"])(
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
