// @vitest-environment jsdom

import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { shouldShowUsageNoticeOnStartup, UsageNotice } from "../src/components/UsageNotice";

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("UsageNotice", () => {
  it("renders the complete mandatory usage disclaimer", () => {
    const markup = renderToStaticMarkup(<UsageNotice open={false} onClose={() => undefined} />);

    expect(markup).toContain("Wichtiger Hinweis");
    expect(markup).toContain("Bitte lesen und bestätigen Sie vor der Nutzung");
    expect(markup).toContain("Keine Entscheidungsgrundlage");
    expect(markup).toContain("Teilweise inoffizielle Datenquellen");
    expect(markup).toContain("Verantwortung des Piloten");
    expect(markup).toContain("Verstanden – Weiter zur App");
    expect(markup).toContain("usage-notice-header");
    expect(markup).toContain("usage-notice-body");
    expect(markup).toContain("usage-notice-footer");
  });

  it("shows the disclaimer on first start and sometimes after acceptance", () => {
    expect(shouldShowUsageNoticeOnStartup()).toBe(true);

    window.localStorage.setItem("g115b-usage-notice-v2-accepted", "true");
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.05);
    expect(shouldShowUsageNoticeOnStartup()).toBe(true);

    randomSpy.mockReturnValue(0.5);
    expect(shouldShowUsageNoticeOnStartup()).toBe(false);
  });
});
