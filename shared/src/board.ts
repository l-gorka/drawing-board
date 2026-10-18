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
