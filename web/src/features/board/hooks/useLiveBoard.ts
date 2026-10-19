import {
  type Board,
  type BoardMessage,
  createBlankBoard,
  type DrawMessage,
  drawCell,
  parseBoardMessage,
  type ResetMessage,
} from "@drawing-board/shared";
import { useQuery } from "@tanstack/react-query";
import { WebSocket as ReconnectingWebSocket } from "partysocket";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard } from "../api/fetchBoard";

function applyMessage(board: Board, message: BoardMessage): Board {
  switch (message.type) {
    case "DRAW":
      return drawCell(board, message.x, message.y, message.color);
    case "RESET":
      return createBlankBoard();
  }
}

export function useLiveBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [connectionGeneration, setConnectionGeneration] = useState(0);
  const connectionSequence = useRef(0);
  const activeConnectionGeneration = useRef<number | null>(null);
  const hydrated = useRef(false);
  const bufferedMessages = useRef<BoardMessage[]>([]);
  const socket = useRef<ReconnectingWebSocket | null>(null);
  const lastResumeAt = useRef(0);

  const { data: snapshot, isError } = useQuery({
    queryKey: ["board", connectionGeneration],
    queryFn: fetchBoard,
    enabled: connectionGeneration > 0,
  });

  useEffect(() => {
    const webSocketUrl = new URL("/ws", window.location.href);
    webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";
    const webSocket = new ReconnectingWebSocket(webSocketUrl.toString());
    socket.current = webSocket;
    let isActive = true;

    webSocket.addEventListener("open", () => {
      if (!isActive) {
        return;
      }

      hydrated.current = false;
      bufferedMessages.current = [];
      const generation = ++connectionSequence.current;
      activeConnectionGeneration.current = generation;
      setConnectionGeneration(generation);
    });

    webSocket.addEventListener("message", (event) => {
      if (!isActive) {
        return;
      }

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

    webSocket.addEventListener("close", () => {
      if (!isActive) {
        return;
      }

      hydrated.current = false;
      bufferedMessages.current = [];
      activeConnectionGeneration.current = null;
    });

    const resumeBoard = () => {
      if (!isActive || document.visibilityState !== "visible") {
        return;
      }

      const now = Date.now();
      if (now - lastResumeAt.current < 100) {
        return;
      }
      lastResumeAt.current = now;
      webSocket.reconnect();
    };

    window.addEventListener("pageshow", resumeBoard);
    document.addEventListener("visibilitychange", resumeBoard);

    return () => {
      isActive = false;
      window.removeEventListener("pageshow", resumeBoard);
      document.removeEventListener("visibilitychange", resumeBoard);
      webSocket.close();
      if (socket.current === webSocket) {
        socket.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (
      !snapshot ||
      hydrated.current ||
      activeConnectionGeneration.current !== connectionGeneration
    ) {
      return;
    }

    const hydratedBoard = bufferedMessages.current.reduce(
      applyMessage,
      snapshot,
    );
    bufferedMessages.current = [];
    hydrated.current = true;
    setBoard(hydratedBoard);
  }, [connectionGeneration, snapshot]);

  const draw = useCallback((message: DrawMessage) => {
    setBoard((currentBoard) =>
      currentBoard ? applyMessage(currentBoard, message) : currentBoard,
    );

    const serializedDraw = JSON.stringify(message);
    socket.current?.send(serializedDraw);
  }, []);

  const reset = useCallback(() => {
    const serializedReset = JSON.stringify({
      type: "RESET",
    } satisfies ResetMessage);
    socket.current?.send(serializedReset);
  }, []);

  return { board, draw, reset, isError };
}
