import { describe, expect, it } from "vitest";
import { BLANK_COLOR, Palette, parseDrawMessage } from "../index";

describe("Palette", () => {
  it("contains sixteen colors including the blank color", () => {
    expect(Palette).toHaveLength(16);
    expect(Palette).toContain(BLANK_COLOR);
    expect(Palette).toContain("#FFFFFF");
  });
});

describe("parseDrawMessage", () => {
  it("accepts a valid DRAW message", () => {
    expect(
      parseDrawMessage('{"type":"DRAW","x":5,"y":10,"color":"#FFFFFF"}'),
    ).toEqual({ type: "DRAW", x: 5, y: 10, color: "#FFFFFF" });
  });

  it.each([
    '{"type":"DRAW","x":-1,"y":0,"color":"#FFFFFF"}',
    '{"type":"DRAW","x":32,"y":0,"color":"#FFFFFF"}',
    '{"type":"DRAW","x":0.5,"y":0,"color":"#FFFFFF"}',
    '{"type":"DRAW","x":0,"y":"0","color":"#FFFFFF"}',
    '{"type":"DRAW","x":0,"y":0,"color":"#123456"}',
    '{"type":"RESET"}',
    "not json",
  ])("rejects invalid input: %s", (input) => {
    expect(parseDrawMessage(input)).toBeNull();
  });
});
