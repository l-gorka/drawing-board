import {
  BLANK_COLOR,
  BOARD_SIZE,
  createBlankBoard,
} from "@drawing-board/shared";
import { describe, expect, it, vi } from "vitest";
import { CELL_SIZE, drawBoard } from "../utils/drawBoard";

function createFakeContext() {
  return {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
  };
}

describe("drawBoard", () => {
  it("fills one square per Cell with the Cell's color", () => {
    const ctx = createFakeContext();
    const board = createBlankBoard();
    board[2][5] = "#FF0000";

    drawBoard(ctx as unknown as CanvasRenderingContext2D, board);

    expect(ctx.fillRect).toHaveBeenCalledTimes(BOARD_SIZE * BOARD_SIZE);
    expect(ctx.fillRect).toHaveBeenCalledWith(
      5 * CELL_SIZE,
      2 * CELL_SIZE,
      CELL_SIZE,
      CELL_SIZE,
    );
  });

  it("uses the blank color for the Cells of a blank Board", () => {
    const ctx = createFakeContext();
    const fillStyles: string[] = [];
    ctx.fillRect.mockImplementation(() => fillStyles.push(ctx.fillStyle));

    drawBoard(ctx as unknown as CanvasRenderingContext2D, createBlankBoard());

    expect(fillStyles.every((style) => style === BLANK_COLOR)).toBe(true);
  });

  it("outlines every Cell so the Cells are visible", () => {
    const ctx = createFakeContext();

    drawBoard(ctx as unknown as CanvasRenderingContext2D, createBlankBoard());

    expect(ctx.strokeRect).toHaveBeenCalledTimes(BOARD_SIZE * BOARD_SIZE);
  });
});
