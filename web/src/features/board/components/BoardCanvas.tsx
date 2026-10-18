import type { Board } from "@drawing-board/shared";
import { useEffect, useRef } from "react";
import { CANVAS_SIZE, drawBoard } from "../utils/drawBoard";

export function BoardCanvas({ board }: { board: Board }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      drawBoard(ctx, board);
    }
  }, [board]);

  return (
    <canvas
      ref={canvasRef}
      width={CANVAS_SIZE}
      height={CANVAS_SIZE}
      aria-label="Board"
    />
  );
}
