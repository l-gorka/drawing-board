import { describe, expect, it } from "vitest";
import { isBoardId, parseCreateBoardRequest } from "../boards-api";

describe("parseCreateBoardRequest", () => {
  it("accepts trimmed non-empty names", () => {
    expect(parseCreateBoardRequest({ name: "  Sketch  " })).toEqual({
      name: "Sketch",
    });
  });

  it.each([
    null,
    undefined,
    {},
    { name: "" },
    { name: "   " },
    { name: 1 },
    { name: null },
  ])("rejects invalid input: %j", (input) => {
    expect(parseCreateBoardRequest(input)).toBeNull();
  });
});

describe("isBoardId", () => {
  it("accepts non-empty ids within the max length", () => {
    expect(isBoardId("main")).toBe(true);
    expect(isBoardId("a".repeat(128))).toBe(true);
  });

  it("rejects empty or overlong ids", () => {
    expect(isBoardId("")).toBe(false);
    expect(isBoardId("a".repeat(129))).toBe(false);
  });
});
