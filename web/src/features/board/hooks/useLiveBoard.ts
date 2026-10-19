import {
  type Board,
  type BoardMessage,
  createBlankBoard,
  type DrawMessage,
  drawCell,
  parseBoardMessage,
  type ResetMessage,
} from "@drawing-board/shared";
import { useQueryClient } from "@tanstack/react-query";
import ReconnectingWebSocket from "partysocket/ws";
import { useCallback, useEffect, useRef, useState } from "react";
import { fetchBoard } from "../api/fetchBoard";

const SNAPSHOT_RETRY_DELAY_MS = 2000;

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
  const [isSnapshotError, setIsSnapshotError] = useState(false);
  const socket = useRef<ReconnectingWebSocket | null>(null);
  const hydrated = useRef(false);
  // Messages to replay on top of the snapshot being loaded: broadcasts received
  // meanwhile, plus this client's own Draws (the server does not echo those).
  const bufferedMessages = useRef<BoardMessage[]>([]);
  // Draws made while disconnected. They are flushed before the connection
  // reopens, so the next snapshot may or may not include them.
  const offlineDraws = useRef<DrawMessage[]>([]);
  const queryClient = useQueryClient();

  useEffect(() => {
    const webSocketUrl = new URL("/ws", window.location.href);
    webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";
    const webSocket = new ReconnectingWebSocket(webSocketUrl.href);
    socket.current = webSocket;

    // Each hydration (the first one and every one after a reconnect) gets its
    // own number, so a stale snapshot response can never overwrite a newer one.
    let hydration = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function loadSnapshot(currentHydration: number): void {
      queryClient.removeQueries({ queryKey: ["board"] });
      queryClient
        .fetchQuery({ queryKey: ["board"], queryFn: fetchBoard, staleTime: 0 })
        .then(
          (snapshot) => {
            if (currentHydration !== hydration) {
              return;
            }
            const hydratedBoard = bufferedMessages.current.reduce(
              applyMessage,
              snapshot,
            );
            bufferedMessages.current = [];
            hydrated.current = true;
            setIsSnapshotError(false);
            setBoard(hydratedBoard);
          },
          () => {
            if (currentHydration !== hydration) {
              return;
            }
            setIsSnapshotError(true);
            retryTimer = setTimeout(
              () => loadSnapshot(currentHydration),
              SNAPSHOT_RETRY_DELAY_MS,
            );
          },
        );
    }

    function hydrate(): void {
      hydration += 1;
      hydrated.current = false;
      bufferedMessages.current = offlineDraws.current;
      offlineDraws.current = [];
      clearTimeout(retryTimer);
      loadSnapshot(hydration);
    }

    function recover(): void {
      // A dropped connection is already being re-established by the socket
      // and hydrates the Board once it opens. An open one may have missed
      // broadcasts while the tab was suspended, so refetch the Board.
      if (webSocket.readyState === ReconnectingWebSocket.OPEN) {
        hydrate();
      }
    }

    function handleVisibilityChange(): void {
      if (document.visibilityState === "visible") {
        recover();
      }
    }

    function handlePageShow(event: PageTransitionEvent): void {
      if (event.persisted) {
        recover();
      }
    }

    webSocket.addEventListener("open", hydrate);

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

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      hydration += 1;
      clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pageshow", handlePageShow);
      webSocket.close();
      if (socket.current === webSocket) {
        socket.current = null;
      }
    };
  }, [queryClient]);

  const draw = useCallback((message: DrawMessage) => {
    setBoard((currentBoard) =>
      currentBoard ? applyMessage(currentBoard, message) : currentBoard,
    );

    const webSocket = socket.current;
    if (webSocket?.readyState !== ReconnectingWebSocket.OPEN) {
      offlineDraws.current.push(message);
    } else if (!hydrated.current) {
      bufferedMessages.current.push(message);
    }
    // Messages sent while disconnected are buffered by the socket and flushed
    // in order as soon as the connection is re-established.
    webSocket?.send(JSON.stringify(message));
  }, []);

  const reset = useCallback(() => {
    socket.current?.send(
      JSON.stringify({ type: "RESET" } satisfies ResetMessage),
    );
  }, []);

  // A failed resync keeps showing the last known Board instead of an error.
  const isError = isSnapshotError && !board;

  return { board, draw, reset, isError };
}
