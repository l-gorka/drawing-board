import {
  type Board,
  type BoardMessage,
  createBlankBoard,
  type DrawMessage,
  parseBoardMessage,
  type ResetMessage,
} from "@drawing-board/shared";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard } from "../api/fetchBoard";

function applyMessage(board: Board, message: BoardMessage): Board {
  if (message.type === "RESET") {
    return createBlankBoard();
  }

  return board.map((row, y) =>
    y === message.y
      ? row.map((color, x) => (x === message.x ? message.color : color))
      : row,
  );
}

export function useLiveBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [webSocketStarted, setWebSocketStarted] = useState(false);
  const hydrated = useRef(false);
  const bufferedMessages = useRef<BoardMessage[]>([]);
  const socket = useRef<WebSocket | null>(null);
  const queuedMessages = useRef<string[]>([]);

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
      for (const message of queuedMessages.current) {
        webSocket.send(message);
      }
      queuedMessages.current = [];
    });

    webSocket.addEventListener("message", (event) => {
      const message = parseBoardMessage(event.data);
      if (!message) {
        return;
      }

      if (!hydrated.current) {
        bufferedMessages.current.push(message);
        return;
      }

      setBoard((currentBoard) =>
        currentBoard ? applyMessage(currentBoard, message) : currentBoard,
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

    const hydratedBoard = bufferedMessages.current.reduce(
      applyMessage,
      snapshot,
    );
    bufferedMessages.current = [];
    hydrated.current = true;
    setBoard(hydratedBoard);
  }, [snapshot]);

  const draw = useCallback((message: DrawMessage) => {
    setBoard((currentBoard) =>
      currentBoard ? applyMessage(currentBoard, message) : currentBoard,
    );

    const serializedDraw = JSON.stringify(message);
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(serializedDraw);
    } else {
      queuedMessages.current.push(serializedDraw);
    }
  }, []);

  const reset = useCallback(() => {
    const serializedReset = JSON.stringify({
      type: "RESET",
    } satisfies ResetMessage);
    if (socket.current?.readyState === WebSocket.OPEN) {
      socket.current.send(serializedReset);
    } else {
      queuedMessages.current.push(serializedReset);
    }
  }, []);

  return { board, draw, reset, isError };
}
