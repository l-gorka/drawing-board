export const BOARD_SIZE = 32;

/** The color of a blank Cell (dark gray). */
export const BLANK_COLOR = "#2B2B2B";

/** The Board as rows of Cell colors: `board[y][x]` is the color of the Cell at column x, row y. */
export type Board = string[][];

export function createBlankBoard(): Board {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => BLANK_COLOR),
  );
}

/** Returns the Board after Drawing a color in one Cell. */
export function drawCell(
  board: Board,
  cellX: number,
  cellY: number,
  color: string,
): Board {
  return board.map((row, rowIndex) =>
    rowIndex === cellY
      ? row.map((cellColor, columnIndex) =>
          columnIndex === cellX ? color : cellColor,
        )
      : row,
  );
}
