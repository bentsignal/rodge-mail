import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MailStore } from "../store";
import { BulkSelectButton } from "./bulk-selection-toolbar";

describe("bulk selection controls", () => {
  it("starts as an accessible inactive toggle", () => {
    const markup = renderToStaticMarkup(
      <MailStore initialAccountFilter="all" initialUnreadOnly={false}>
        <BulkSelectButton />
      </MailStore>,
    );

    expect(markup).toContain("Select");
    expect(markup).toContain('aria-pressed="false"');
    expect(markup).toContain('type="button"');
  });
});
