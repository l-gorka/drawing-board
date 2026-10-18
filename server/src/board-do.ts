import { DurableObject } from "cloudflare:workers";
import { type Board, createBlankBoard } from "@drawing-board/shared";

/** The single Durable Object that holds the Board. */
export class BoardDO extends DurableObject {
  async getBoard(): Promise<Board> {
    return createBlankBoard();
  }
}
