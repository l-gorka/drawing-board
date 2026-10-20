import { evictDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import {
  BLANK_COLOR,
  BOARD_SIZE,
  type Board,
  type BoardSummary,
  type DrawMessage,
} from "@drawing-board/shared";
import { describe, expect, it } from "vitest";

async function getBoard(path = "/api/board"): Promise<Board> {
  const response = await exports.default.fetch(`http://example.com${path}`);
  expect(response.status).toBe(200);
  return (await response.json()) as Board;
}

async function getBoardById(boardId: string): Promise<Board> {
  return getBoard(`/api/board/${boardId}`);
}

async function connect(path = "/ws"): Promise<WebSocket> {
  const response = await exports.default.fetch(`http://example.com${path}`, {
    headers: { Upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  if (!response.webSocket) {
    throw new Error("Expected a WebSocket upgrade response");
  }

  response.webSocket.accept();
  return response.webSocket;
}

async function connectToBoard(boardId: string): Promise<WebSocket> {
  return connect(`/ws/${boardId}`);
}

async function listBoards(): Promise<BoardSummary[]> {
  const response = await exports.default.fetch("http://example.com/api/boards");
  expect(response.status).toBe(200);
  const body = (await response.json()) as { boards: BoardSummary[] };
  return body.boards;
}

async function createBoard(name: string): Promise<BoardSummary> {
  const response = await exports.default.fetch("http://example.com/api/boards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  expect(response.status).toBe(201);
  return (await response.json()) as BoardSummary;
}

function nextMessage(socket: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    socket.addEventListener(
      "message",
      (event) => resolve(event.data as string),
      { once: true },
    );
  });
}

describe("the Board API", () => {
  it("returns a 32x32 Board of blank Cells", async () => {
    const board = await getBoard();
    expect(board).toHaveLength(BOARD_SIZE);
    for (const row of board) {
      expect(row).toHaveLength(BOARD_SIZE);
      expect(row.every((color) => color === BLANK_COLOR)).toBe(true);
    }
  });

  it("lists boards with the default main board", async () => {
    const boards = await listBoards();
    expect(boards.some((board) => board.id === "main" && board.name === "Main")).toBe(
      true,
    );
  });

  it("creates a board with a display name", async () => {
    const created = await createBoard("Sketch pad");
    expect(created.name).toBe("Sketch pad");
    expect(created.id).toBeTruthy();
    expect(created.id).not.toBe("main");

    const boards = await listBoards();
    expect(boards.some((board) => board.id === created.id)).toBe(true);
  });

  it("rejects creating a board with an empty name", async () => {
    const response = await exports.default.fetch("http://example.com/api/boards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   " }),
    });
    expect(response.status).toBe(400);
  });

  it("returns 404 for unknown board ids", async () => {
    const httpResponse = await exports.default.fetch(
      "http://example.com/api/board/unknown-board-id",
    );
    expect(httpResponse.status).toBe(404);

    const wsResponse = await exports.default.fetch(
      "http://example.com/ws/unknown-board-id",
      { headers: { Upgrade: "websocket" } },
    );
    expect(wsResponse.status).toBe(404);
  });

  it("isolates grids between boards", async () => {
    const second = await createBoard("Second");
    const socket = await connectToBoard(second.id);
    const draw: DrawMessage = {
      type: "DRAW",
      x: 2,
      y: 3,
      color: "#FFFFFF",
    };

    socket.send(JSON.stringify(draw));
    expect((await getBoardById(second.id))[3][2]).toBe("#FFFFFF");
    expect((await getBoard())[3][2]).toBe(BLANK_COLOR);
  });

  it("isolates WebSocket broadcasts between boards", async () => {
    const second = await createBoard("Isolated");
    const boardA = await connectToBoard("main");
    const boardB = await connectToBoard(second.id);
    const draw: DrawMessage = {
      type: "DRAW",
      x: 5,
      y: 6,
      color: "#E50000",
    };
    let receivedOnMain = false;
    boardA.addEventListener("message", () => {
      receivedOnMain = true;
    });

    boardB.send(JSON.stringify(draw));
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(receivedOnMain).toBe(false);
    expect((await getBoardById(second.id))[6][5]).toBe("#E50000");
  });

  it("scopes Reset to one board", async () => {
    const second = await createBoard("Reset target");
    const mainSocket = await connect();
    const secondSocket = await connectToBoard(second.id);
    const draw: DrawMessage = {
      type: "DRAW",
      x: 1,
      y: 1,
      color: "#0083C7",
    };

    mainSocket.send(JSON.stringify(draw));
    secondSocket.send(JSON.stringify(draw));
    expect((await getBoard())[1][1]).toBe("#0083C7");
    expect((await getBoardById(second.id))[1][1]).toBe("#0083C7");

    secondSocket.send(JSON.stringify({ type: "RESET" }));
    expect((await getBoard())[1][1]).toBe("#0083C7");
    expect(
      (await getBoardById(second.id)).every((row) =>
        row.every((color) => color === BLANK_COLOR),
      ),
    ).toBe(true);
  });

  it("broadcasts a valid Draw to every WebSocket client and updates the Board", async () => {
    const sender = await connect();
    const recipient = await connect();
    const draw: DrawMessage = {
      type: "DRAW",
      x: 4,
      y: 7,
      color: "#FFFFFF",
    };
    const senderMessage = nextMessage(sender);
    const recipientMessage = nextMessage(recipient);

    sender.send(JSON.stringify(draw));

    expect(await senderMessage).toBe(JSON.stringify(draw));
    expect(await recipientMessage).toBe(JSON.stringify(draw));
    expect((await getBoard())[7][4]).toBe("#FFFFFF");
  });

  it("restores Drawn Cells after Durable Object eviction", async () => {
    const socket = await connect();
    const draw: DrawMessage = {
      type: "DRAW",
      x: 15,
      y: 16,
      color: "#E50000",
    };

    socket.send(JSON.stringify(draw));
    expect((await getBoard())[draw.y][draw.x]).toBe(draw.color);
    await evictDurableObject(env.BOARD.getByName("main"));

    expect((await getBoard())[draw.y][draw.x]).toBe(draw.color);
  });

  it("restores a named board after its Durable Object is evicted", async () => {
    const created = await createBoard("Persist me");
    const socket = await connectToBoard(created.id);
    const draw: DrawMessage = {
      type: "DRAW",
      x: 8,
      y: 9,
      color: "#E5D900",
    };

    socket.send(JSON.stringify(draw));
    expect((await getBoardById(created.id))[draw.y][draw.x]).toBe(draw.color);
    await evictDurableObject(env.BOARD.getByName(created.id));

    expect((await getBoardById(created.id))[draw.y][draw.x]).toBe(draw.color);
  });

  it("resets the Board for every WebSocket client and persists it", async () => {
    const sender = await connect();
    const recipient = await connect();
    const draw: DrawMessage = {
      type: "DRAW",
      x: 9,
      y: 11,
      color: "#E50000",
    };

    sender.send(JSON.stringify(draw));
    expect((await getBoard())[draw.y][draw.x]).toBe(draw.color);

    const reset = JSON.stringify({ type: "RESET" });
    const senderMessage = nextMessage(sender);
    const recipientMessage = nextMessage(recipient);
    sender.send(reset);

    expect(await senderMessage).toBe(reset);
    expect(await recipientMessage).toBe(reset);
    expect(
      (await getBoard()).every((row) =>
        row.every((color) => color === BLANK_COLOR),
      ),
    ).toBe(true);
    await evictDurableObject(env.BOARD.getByName("main"));
    expect(
      (await getBoard()).every((row) =>
        row.every((color) => color === BLANK_COLOR),
      ),
    ).toBe(true);
  });

  it("silently drops an invalid Draw", async () => {
    const socket = await connect();

    socket.send('{"type":"DRAW","x":0,"y":0,"color":"#123456"}');

    expect((await getBoard())[0][0]).toBe(BLANK_COLOR);
  });

  it("silently drops an unknown message type", async () => {
    const socket = await connect();

    socket.send('{"type":"UNKNOWN"}');

    expect(
      (await getBoard()).every((row) =>
        row.every((color) => color === BLANK_COLOR),
      ),
    ).toBe(true);
  });
});
