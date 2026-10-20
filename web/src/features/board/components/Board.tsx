import {
  DEFAULT_BOARD_ID,
  type Color,
  type DrawMessage,
  Palette,
} from "@drawing-board/shared";
import { useState } from "react";
import { useLiveBoard } from "../hooks/useLiveBoard";
import { BoardCanvas } from "./BoardCanvas";
import { BoardLoading } from "./BoardLoading";
import { BoardSwitcher } from "./BoardSwitcher";

const DEFAULT_DRAW_COLOR = Palette[1];

export function Board() {
  const [activeBoardId, setActiveBoardId] = useState(DEFAULT_BOARD_ID);
  const { board, draw, reset, isError } = useLiveBoard(activeBoardId);
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

  return (
    <div className="board-layout">
      <BoardSwitcher
        activeBoardId={activeBoardId}
        onActiveBoardChange={setActiveBoardId}
      />
      {!board ? (
        <BoardLoading />
      ) : (
        <>
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
          <button onClick={reset} type="button">
            Reset
          </button>
        </>
      )}
    </div>
  );
}
