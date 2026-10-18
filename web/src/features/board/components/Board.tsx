import { type Color, type DrawMessage, Palette } from "@drawing-board/shared";
import { useState } from "react";
import { useLiveBoard } from "../hooks/useLiveBoard";
import { BoardCanvas } from "./BoardCanvas";

const DEFAULT_DRAW_COLOR = Palette[1];

export function Board() {
  const { board, draw, isError } = useLiveBoard();
  const [selectedColor, setSelectedColor] = useState<Color>(DEFAULT_DRAW_COLOR);

  function handleDraw(x: number, y: number): void {
    const message: DrawMessage = {
      type: "DRAW",
      x,
      y,
      color: selectedColor,
    };
    draw(message);
  }

  if (isError) {
    return <p>Could not load the Board.</p>;
  }

  if (!board) {
    return <p>Loading the Board…</p>;
  }

  return (
    <div className="board-layout">
      <BoardCanvas board={board} onDraw={handleDraw} />
      <fieldset aria-label="Palette" className="palette">
        {Palette.map((color) => (
          <button
            aria-label={`Select ${color}`}
            aria-pressed={selectedColor === color}
            className="palette-color"
            key={color}
            onClick={() => setSelectedColor(color)}
            type="button"
          >
            <svg aria-hidden="true" viewBox="0 0 1 1">
              <rect fill={color} height="1" width="1" />
            </svg>
          </button>
        ))}
      </fieldset>
    </div>
  );
}
