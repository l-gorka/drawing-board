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
import ReconnectingWebSocket from "partysocket/ws";
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

function createWebSocket(): ReconnectingWebSocket {
  const webSocketUrl = new URL("/ws", window.location.href);
  webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";
  return new ReconnectingWebSocket(webSocketUrl.toString());
}

function isStale(socket: ReconnectingWebSocket): boolean {
  return socket.readyState !== ReconnectingWebSocket.OPEN;
}

export function useLiveBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [isError, setIsError] = useState(false);
  // Messages seen while the current snapshot loads, replayed on top of it so
  // re-hydration never loses a concurrent Draw.
  const bufferedMessages = useRef<BoardMessage[]>([]);
  const hydrated = useRef(false);
  const socket = useRef<ReconnectingWebSocket | null>(null);
  // Driven manually: the snapshot is fetched on every WebSocket `open`, so the
  // connection is established before the first Board fetch.
  const { refetch } = useQuery({
    queryKey: ["board"],
    queryFn: fetchBoard,
    enabled: false,
  });

  // Re-runs per connection: on each `open` the Board is re-hydrated from the
  // server-authoritative snapshot, so a reconnect never shows a stale Board.
  const hydrate = useCallback(async () => {
    bufferedMessages.current = [];
    hydrated.current = false;
    const result = await refetch();
    if (result.error) {
      setIsError(true);
      return;
    }

    setIsError(false);
    const snapshot = result.data;
    if (snapshot) {
      setBoard(bufferedMessages.current.reduce(applyMessage, snapshot));
      hydrated.current = true;
    }
  }, [refetch]);

  useEffect(() => {
    const webSocket = createWebSocket();
    socket.current = webSocket;

    const handleMessage = (event: MessageEvent) => {
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
    };

    // A suspended/backgrounded tab can silently lose its socket without a
    // close event, so recover when it becomes visible again: reconnect if the
    // connection is down, otherwise re-hydrate the Board.
    const recover = () => {
      if (isStale(webSocket)) {
        webSocket.reconnect();
        return;
      }
      void hydrate();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState !== "hidden") {
        recover();
      }
    };

    webSocket.addEventListener("open", () => {
      void hydrate();
    });
    webSocket.addEventListener("message", handleMessage);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", recover);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", recover);
      // Deliberate teardown: close() disables partysocket's auto-reconnect.
      webSocket.close();
      if (socket.current === webSocket) {
        socket.current = null;
      }
    };
  }, [hydrate]);

  const draw = useCallback((message: DrawMessage) => {
    setBoard((currentBoard) =>
      currentBoard ? applyMessage(currentBoard, message) : currentBoard,
    );
    // partysocket buffers while disconnected and flushes on the next `open`.
    socket.current?.send(JSON.stringify(message));
  }, []);

  const reset = useCallback(() => {
    socket.current?.send(
      JSON.stringify({ type: "RESET" } satisfies ResetMessage),
    );
  }, []);

  return { board, draw, reset, isError };
}
