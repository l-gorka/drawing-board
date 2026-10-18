import { BOARD_SIZE, type Board } from "@drawing-board/shared";

/** Size of one Cell on the Canvas, in screen pixels. */
export const CELL_SIZE = 16;

export const CANVAS_SIZE = BOARD_SIZE * CELL_SIZE;

const GRID_COLOR = "#3D3D3D";

export function drawBoard(ctx: CanvasRenderingContext2D, board: Board): void {
  ctx.strokeStyle = GRID_COLOR;
  ctx.lineWidth = 1;

  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      ctx.fillStyle = board[y][x];
      ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }
  }
}
