import type { Board } from "@drawing-board/shared";
import { useEffect, useRef } from "react";
import { CANVAS_SIZE, CELL_SIZE, drawBoard } from "../utils/drawBoard";

type BoardCanvasProps = {
  board: Board;
  onDraw: (x: number, y: number) => void;
};

export function BoardCanvas({ board, onDraw }: BoardCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      drawBoard(ctx, board);
    }
  }, [board]);

  function drawAtPointer(event: React.PointerEvent<HTMLCanvasElement>): void {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const bounds = canvas.getBoundingClientRect();
    const x = Math.floor(
      ((event.clientX - bounds.left) * canvas.width) / bounds.width / CELL_SIZE,
    );
    const y = Math.floor(
      ((event.clientY - bounds.top) * canvas.height) /
        bounds.height /
        CELL_SIZE,
    );

    if (x >= 0 && y >= 0 && x < board[0].length && y < board.length) {
      onDraw(x, y);
    }
  }

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      aria-label="Board"
      className="board-canvas"
      onPointerDown={(event) => {
        isDrawing.current = true;
        if (event.pointerType === "touch" || event.pointerType === "pen") {
          event.preventDefault();
        }
        event.currentTarget.setPointerCapture?.(event.pointerId);
        drawAtPointer(event);
      }}
      onPointerMove={(event) => {
        if (isDrawing.current) {
          if (event.pointerType === "touch" || event.pointerType === "pen") {
            event.preventDefault();
          }
          drawAtPointer(event);
        }
      }}
      onPointerUp={() => {
        isDrawing.current = false;
      }}
      onPointerCancel={() => {
        isDrawing.current = false;
      }}
    />
  );
}
