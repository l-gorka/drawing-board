export type { Board } from "./board";
export { BLANK_COLOR, BOARD_SIZE, createBlankBoard } from "./board";
export type {
  BoardMessage,
  Color,
  DrawMessage,
  ResetMessage,
} from "./messages";
export { Palette, parseBoardMessage, parseDrawMessage } from "./messages";
