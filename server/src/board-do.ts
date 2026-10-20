import { DurableObject } from "cloudflare:workers";
import {
  type Board,
  createBlankBoard,
  drawCell,
  parseBoardMessage,
} from "@drawing-board/shared";

type Env = {
  BOARD: DurableObjectNamespace<BoardDO>;
};

/** Durable Object that holds one Board grid. */
export class BoardDO extends DurableObject<Env> {
  private board = createBlankBoard();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      this.board =
        (await this.ctx.storage.get<Board>("board")) ?? createBlankBoard();
    });
  }

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
    _sender: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    const boardMessage = parseBoardMessage(message);
    if (!boardMessage) {
      return;
    }

    let updatedBoard: Board;
    switch (boardMessage.type) {
      case "DRAW":
        updatedBoard = drawCell(
          this.board,
          boardMessage.x,
          boardMessage.y,
          boardMessage.color,
        );
        break;
      case "RESET":
        updatedBoard = createBlankBoard();
        break;
    }
    await this.ctx.storage.put("board", updatedBoard);
    this.board = updatedBoard;

    const serializedMessage = JSON.stringify(boardMessage);
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(serializedMessage);
    }
  }
}
