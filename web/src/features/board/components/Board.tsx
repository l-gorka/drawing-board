import { type DrawMessage, Palette } from "@drawing-board/shared";
import { useLiveBoard } from "../hooks/useLiveBoard";
import { BoardCanvas } from "./BoardCanvas";

const DEFAULT_DRAW_COLOR = Palette[1];

export function Board() {
  const { board, draw, isError } = useLiveBoard();

  function handleDraw(x: number, y: number): void {
    const message: DrawMessage = {
      type: "DRAW",
      x,
      y,
      color: DEFAULT_DRAW_COLOR,
    };
    draw(message);
  }

  if (isError) {
    return <p>Could not load the Board.</p>;
  }

  if (!board) {
    return <p>Loading the Board…</p>;
  }

  return <BoardCanvas board={board} onDraw={handleDraw} />;
}
