import { DurableObject } from "cloudflare:workers";
import {
  type BoardSummary,
  DEFAULT_BOARD_ID,
  parseCreateBoardRequest,
} from "@drawing-board/shared";

const STORAGE_KEY = "boards";
const CATALOG_NAME = "catalog";

type Env = {
  BOARD_CATALOG: DurableObjectNamespace<BoardCatalogDO>;
};

const DEFAULT_BOARDS: BoardSummary[] = [
  { id: DEFAULT_BOARD_ID, name: "Main" },
];

/** Persists the list of Boards (id + display name). */
export class BoardCatalogDO extends DurableObject<Env> {
  private boards: BoardSummary[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.ctx.blockConcurrencyWhile(async () => {
      const stored = await this.ctx.storage.get<BoardSummary[]>(STORAGE_KEY);
      this.boards = stored ?? [...DEFAULT_BOARDS];
      if (!stored) {
        await this.ctx.storage.put(STORAGE_KEY, this.boards);
      }
    });
  }

  async listBoards(): Promise<BoardSummary[]> {
    return this.boards;
  }

  async hasBoard(id: string): Promise<boolean> {
    return this.boards.some((board) => board.id === id);
  }

  async createBoard(name: string): Promise<BoardSummary | null> {
    const parsed = parseCreateBoardRequest({ name });
    if (!parsed) {
      return null;
    }

    const entry: BoardSummary = {
      id: crypto.randomUUID(),
      name: parsed.name,
    };
    this.boards = [...this.boards, entry];
    await this.ctx.storage.put(STORAGE_KEY, this.boards);
    return entry;
  }
}

export { CATALOG_NAME };
