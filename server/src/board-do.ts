import { DurableObject } from "cloudflare:workers";
import {
  type Board,
  createBlankBoard,
  parseDrawMessage,
} from "@drawing-board/shared";

/** The single Durable Object that holds the Board. */
export class BoardDO extends DurableObject {
  private readonly board = createBlankBoard();

  async getBoard(): Promise<Board> {
    return this.board;
  }

  async fetch(_request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);
    this.ctx.acceptWebSocket(server);

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(
    sender: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const draw = parseDrawMessage(message);
    if (!draw) {
      return;
    }

    this.board[draw.y][draw.x] = draw.color;
    const serializedDraw = JSON.stringify(draw);
    for (const socket of this.ctx.getWebSockets()) {
      if (socket !== sender) {
        socket.send(serializedDraw);
      }
    }
  }
}
