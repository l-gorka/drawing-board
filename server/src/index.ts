import {
  DEFAULT_BOARD_ID,
  isBoardId,
  parseCreateBoardRequest,
} from "@drawing-board/shared";
import { Hono } from "hono";
import type { BoardCatalogDO } from "./board-catalog-do";
import { CATALOG_NAME } from "./board-catalog-do";
import type { BoardDO } from "./board-do";

export { BoardCatalogDO } from "./board-catalog-do";
export { BoardDO } from "./board-do";

type Bindings = {
  BOARD: DurableObjectNamespace<BoardDO>;
  BOARD_CATALOG: DurableObjectNamespace<BoardCatalogDO>;
};

function getBoardStub(env: Bindings, boardId: string) {
  return env.BOARD.getByName(boardId);
}

function getCatalogStub(env: Bindings) {
  return env.BOARD_CATALOG.getByName(CATALOG_NAME);
}

async function boardExists(env: Bindings, boardId: string): Promise<boolean> {
  if (!isBoardId(boardId)) {
    return false;
  }
  return getCatalogStub(env).hasBoard(boardId);
}

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/boards", async (c) => {
  const boards = await getCatalogStub(c.env).listBoards();
  return c.json({ boards });
});

app.post("/api/boards", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.text("Invalid JSON body", 400);
  }

  const request = parseCreateBoardRequest(body);
  if (!request) {
    return c.text("Invalid board name", 400);
  }

  const created = await getCatalogStub(c.env).createBoard(request.name);
  if (!created) {
    return c.text("Invalid board name", 400);
  }

  return c.json(created, 201);
});

app.get("/api/board", async (c) => {
  const board = await getBoardStub(c.env, DEFAULT_BOARD_ID).getBoard();
  return c.json(board);
});

app.get("/api/board/:boardId", async (c) => {
  const boardId = c.req.param("boardId");
  if (!(await boardExists(c.env, boardId))) {
    return c.text("Board not found", 404);
  }
  const board = await getBoardStub(c.env, boardId).getBoard();
  return c.json(board);
});

app.get("/ws", (c) =>
  getBoardStub(c.env, DEFAULT_BOARD_ID).fetch(c.req.raw),
);

app.get("/ws/:boardId", async (c) => {
  const boardId = c.req.param("boardId");
  if (!(await boardExists(c.env, boardId))) {
    return c.text("Board not found", 404);
  }
  return getBoardStub(c.env, boardId).fetch(c.req.raw);
});

export default app;
