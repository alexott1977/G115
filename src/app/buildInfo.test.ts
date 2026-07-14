import { describe, expect, it } from "vitest";
import { formatBuildVersion } from "./buildInfo";

describe("build version", () => {
  it("formats clean commit versions", () => {
    expect(
      formatBuildVersion({
        fullCommit: "1234567890abcdef",
        shortCommit: "1234567",
        dirty: false,
        builtAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toBe("VERSION: 1234567");
  });

  it("marks locally modified builds", () => {
    expect(
      formatBuildVersion({
        fullCommit: "1234567890abcdef",
        shortCommit: "1234567",
        dirty: true,
        builtAt: "2026-06-14T00:00:00.000Z",
      }),
    ).toBe("VERSION: 1234567");
  });
});
