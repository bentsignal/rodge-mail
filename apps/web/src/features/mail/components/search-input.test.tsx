import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MailStore } from "../store";
import { ClearSearchButton, SearchInput } from "./inbox-pane";

function renderWithMailStore(children: React.ReactNode) {
  return renderToStaticMarkup(
    <MailStore initialAccountFilter="all" initialUnreadOnly={false}>
      {children}
    </MailStore>,
  );
}

describe("mail search controls", () => {
  it("uses search semantics without the browser's duplicate clear control", () => {
    const markup = renderWithMailStore(<SearchInput />);

    expect(markup).toContain('role="searchbox"');
    expect(markup.toLowerCase()).toContain('inputmode="search"');
    expect(markup).toContain('type="text"');
    expect(markup).not.toContain('type="search"');
  });

  it("renders one labeled keyboard-operable clear button", () => {
    const markup = renderWithMailStore(<ClearSearchButton query="invoice" />);

    expect(markup.match(/aria-label="Clear search"/gu)).toHaveLength(1);
    expect(markup).toContain('type="button"');
  });
});
