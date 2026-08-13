import { describe, expect, it } from "vitest";

import {
  classificationRequest,
  cleanViewRequest,
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
  it("uses the dedicated clean-view model and supported reasoning effort", () => {
    expect(
      cleanViewRequest({
        direction: "incoming",
        from: { address: "locker@example.com" },
        to: [{ address: "owner@example.com" }],
        cc: [],
        subject: "Package ready",
        snippet: "Use code 482913",
        body: "Use code 482913",
        headers: [],
        hasAttachments: false,
        isPinned: false,
        bodyWasTruncated: false,
      }),
    ).toMatchObject({
      model: "gpt-5.6-luna",
      max_output_tokens: 2_000,
      reasoning: { effort: "low" },
    });
  });

  it("validates concise content and an extracted action code", () => {
    expect(
      parseCleanView(
        JSON.stringify({
          schemaVersion: "clean-view-v2",
          summary: "Your package is ready for pickup.",
          cleanedMarkdown: "Pick it up from the lobby locker by Friday.",
          code: { label: "Pickup code", value: "482913" },
        }),
      ),
    ).toMatchObject({
      summary: "Your package is ready for pickup.",
      cleanedMarkdown: "Pick it up from the lobby locker by Friday.",
      code: { label: "Pickup code", value: "482913" },
    });
  });

  it("accepts clean views without an actionable code", () => {
    expect(
      parseCleanView(
        JSON.stringify({
          schemaVersion: "clean-view-v2",
          summary: "Review and reply before Friday.",
          cleanedMarkdown: "The proposal needs your approval by Friday.",
          code: null,
        }),
      ),
    ).toHaveProperty("code", null);
  });

  it("rejects ambiguous or incomplete code output", () => {
    expect(() =>
      parseCleanView(
        JSON.stringify({
          schemaVersion: "clean-view-v2",
          summary: "Your package shipped.",
          cleanedMarkdown: "It arrives Friday.",
          code: { label: "Tracking number" },
        }),
      ),
    ).toThrow("Model returned an invalid clean view");
  });
});
