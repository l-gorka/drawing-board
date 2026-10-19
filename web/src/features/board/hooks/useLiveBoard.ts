import {
  type Board,
  type BoardMessage,
  createBlankBoard,
  type DrawMessage,
  drawCell,
  parseBoardMessage,
  type ResetMessage,
} from "@drawing-board/shared";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

export function useLiveBoard() {
  const [board, setBoard] = useState<Board | null>(null);
  const [webSocketStarted, setWebSocketStarted] = useState(false);
  const hydrated = useRef(false);
  const bufferedMessages = useRef<BoardMessage[]>([]);
  const socket = useRef<ReconnectingWebSocket | null>(null);
  const queryClient = useQueryClient();

  const { data: snapshot, isError } = useQuery({
    queryKey: ["board"],
    queryFn: fetchBoard,
    enabled: webSocketStarted,
  });

  useEffect(() => {
    const webSocketUrl = new URL("/ws", window.location.href);
    webSocketUrl.protocol = webSocketUrl.protocol === "https:" ? "wss:" : "ws:";
    const webSocket = new ReconnectingWebSocket(webSocketUrl.toString());
    socket.current = webSocket;

    webSocket.addEventListener("open", () => {
      hydrated.current = false;
      bufferedMessages.current = [];
      queryClient.removeQueries({ queryKey: ["board"] });
      setWebSocketStarted(true);
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

    function syncOnVisible() {
      if (
        webSocket.readyState === ReconnectingWebSocket.OPEN &&
        document.visibilityState === "visible"
      ) {
        hydrated.current = false;
        bufferedMessages.current = [];
        queryClient.removeQueries({ queryKey: ["board"] });
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState === "visible") {
        syncOnVisible();
      }
    }

    function onPageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        syncOnVisible();
      }
    }

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pageshow", onPageShow);
      webSocket.close();
      if (socket.current === webSocket) {
        socket.current = null;
      }
    };
  }, [queryClient.removeQueries]);

  useEffect(() => {
    if (!webSocketStarted || !snapshot || hydrated.current) {
      return;
    }

    const hydratedBoard = bufferedMessages.current.reduce(
      applyMessage,
      snapshot,
    );
    bufferedMessages.current = [];
    hydrated.current = true;
    setBoard(hydratedBoard);
  }, [snapshot, webSocketStarted]);

  const draw = useCallback((message: DrawMessage) => {
    setBoard((currentBoard) =>
      currentBoard ? applyMessage(currentBoard, message) : currentBoard,
    );

    socket.current?.send(JSON.stringify(message));
  }, []);

  const reset = useCallback(() => {
    socket.current?.send(
      JSON.stringify({
        type: "RESET",
      } satisfies ResetMessage),
    );
  }, []);

  return { board, draw, reset, isError };
}
