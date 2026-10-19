import { evictDurableObject } from "cloudflare:test";
import { env, exports } from "cloudflare:workers";
import {
  BLANK_COLOR,
  BOARD_SIZE,
  type Board,
  type DrawMessage,
} from "@drawing-board/shared";
import { describe, expect, it } from "vitest";

async function getBoard(): Promise<Board> {
  const response = await exports.default.fetch("http://example.com/api/board");
  expect(response.status).toBe(200);
  return (await response.json()) as Board;
}

async function connect(): Promise<WebSocket> {
  const response = await exports.default.fetch("http://example.com/ws", {
    headers: { Upgrade: "websocket" },
  });
  expect(response.status).toBe(101);
  if (!response.webSocket) {
    throw new Error("Expected a WebSocket upgrade response");
  }

  response.webSocket.accept();
  return response.webSocket;
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
