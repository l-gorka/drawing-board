import { describe, expect, it } from "vitest";
import { BLANK_COLOR, BOARD_SIZE, createBlankBoard } from "../board";

describe("createBlankBoard", () => {
  it("creates a 32x32 Board", () => {
    const board = createBlankBoard();

    expect(BOARD_SIZE).toBe(32);
    expect(board).toHaveLength(BOARD_SIZE);
    for (const row of board) {
      expect(row).toHaveLength(BOARD_SIZE);
    }
  });

  it("fills every Cell with the blank color", () => {
    const board = createBlankBoard();

    expect(board.flat().every((color) => color === BLANK_COLOR)).toBe(true);
  });

  it("returns a new Board each time", () => {
    const first = createBlankBoard();
    const second = createBlankBoard();

    first[0][0] = "#000000";

    expect(second[0][0]).toBe(BLANK_COLOR);
  });
});
