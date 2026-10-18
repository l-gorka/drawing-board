import { exports } from "cloudflare:workers";
import { BLANK_COLOR, BOARD_SIZE, type Board } from "@drawing-board/shared";
import { describe, expect, it } from "vitest";

describe("GET /api/board", () => {
  it("returns a 32x32 Board of blank Cells", async () => {
    const response = await exports.default.fetch(
      "http://example.com/api/board",
    );

    expect(response.status).toBe(200);

    const board = (await response.json()) as Board;
    expect(board).toHaveLength(BOARD_SIZE);
    for (const row of board) {
      expect(row).toHaveLength(BOARD_SIZE);
      expect(row.every((color) => color === BLANK_COLOR)).toBe(true);
    }
  });
});
