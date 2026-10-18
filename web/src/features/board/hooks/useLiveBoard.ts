import {
  type Board,
  type DrawMessage,
  parseDrawMessage,
} from "@drawing-board/shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard } from "../api/fetchBoard";

function applyDraw(board: Board, draw: DrawMessage): Board {
  return board.map((row, y) =>
    y === draw.y
      ? row.map((color, x) => (x === draw.x ? draw.color : color))
      : row,
  );
}

export function useLiveBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [webSocketStarted, setWebSocketStarted] = useState(false);
  const hydrated = useRef(false);
  const bufferedDraws = useRef<DrawMessage[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const queuedDraws = useRef<string[]>([]);

  const { data: snapshot, isError } = useQuery({
    queryKey: ["board"],
    queryFn: fetchBoard,
    enabled: webSocketStarted,
  });

  useEffect(() => {
    const webSocketUrl = new URL("/ws", window.location.href);
    webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";
    const webSocket = new WebSocket(webSocketUrl);
    socket.current = webSocket;
    setWebSocketStarted(true);

    webSocket.addEventListener("open", () => {
      for (const draw of queuedDraws.current) {
        webSocket.send(draw);
      }
      queuedDraws.current = [];
    });

    webSocket.addEventListener("message", (event) => {
      const draw = parseDrawMessage(event.data);
      if (!draw) {
        return;
      }

      if (!hydrated.current) {
        bufferedDraws.current.push(draw);
        return;
      }

      setBoard((currentBoard) =>
        currentBoard ? applyDraw(currentBoard, draw) : currentBoard,
      );
    });

    return () => {
      webSocket.close();
      if (socket.current === webSocket) {
        socket.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!snapshot || hydrated.current) {
      return;
    }

    const hydratedBoard = bufferedDraws.current.reduce(applyDraw, snapshot);
    bufferedDraws.current = [];
    hydrated.current = true;
    setBoard(hydratedBoard);
  }, [snapshot]);

  const draw = useCallback((message: DrawMessage) => {
    setBoard((currentBoard) =>
      currentBoard ? applyDraw(currentBoard, message) : currentBoard,
    );

    const serializedDraw = JSON.stringify(message);
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(serializedDraw);
    } else {
      queuedDraws.current.push(serializedDraw);
    }
  }, []);

  return { board, draw, isError };
}
