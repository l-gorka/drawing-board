import { Hono } from "hono";
import type { BoardDO } from "./board-do";

export { BoardDO } from "./board-do";

type Bindings = {
  BOARD: DurableObjectNamespace<BoardDO>;
};

const BOARD_NAME = "main";

const app = new Hono<{ Bindings: Bindings }>();

app.get("/api/board", async (c) => {
  const board = await c.env.BOARD.getByName(BOARD_NAME).getBoard();
  return c.json(board);
});

export default app;
