import { BOARD_SIZE, createBlankBoard } from "@drawing-board/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Board } from "../components/Board";
import { CANVAS_SIZE } from "../utils/drawBoard";

const fakeContext = {
  fillStyle: "",
  strokeStyle: "",
  lineWidth: 0,
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
};

class FakeWebSocket extends EventTarget {
  static readonly OPEN = 1;

  readonly send = vi.fn();
  readonly close = vi.fn();
  readyState = FakeWebSocket.OPEN;

  constructor(_url: string | URL) {
    super();
    webSocket = this;
  }
}

let webSocket: FakeWebSocket;

function renderBoard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <Board />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fakeContext.fillRect.mockClear();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    fakeContext as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Board", () => {
  it("loads the Board from /api/board and renders it on a Canvas", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(Response.json(createBlankBoard()));

    renderBoard();

    const canvas = await screen.findByLabelText<HTMLCanvasElement>("Board");

    expect(fetchMock).toHaveBeenCalledWith("/api/board");
    expect(canvas.width).toBe(CANVAS_SIZE);
    expect(canvas.height).toBe(CANVAS_SIZE);
    expect(fakeContext.fillRect).toHaveBeenCalledTimes(BOARD_SIZE * BOARD_SIZE);
  });

  it("shows an error message when the Board cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );

    renderBoard();

    expect(await screen.findByText("Could not load the Board.")).toBeTruthy();
  });

  it("sends DRAW messages when clicking and dragging across Cells", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(createBlankBoard()),
    );
    const bounds = {
      bottom: CANVAS_SIZE,
      height: CANVAS_SIZE,
      left: 0,
      right: CANVAS_SIZE,
      top: 0,
      width: CANVAS_SIZE,
      x: 0,
      y: 0,
      toJSON: () => "",
    };
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue(bounds);

    renderBoard();

    const canvas = await screen.findByLabelText<HTMLCanvasElement>("Board");
    fireEvent.pointerDown(canvas, { clientX: 2 * 16 + 1, clientY: 3 * 16 + 1 });
    fireEvent.pointerMove(canvas, { clientX: 3 * 16 + 1, clientY: 3 * 16 + 1 });

    expect(webSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
    );
    expect(webSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 3, y: 3, color: "#FFFFFF" }),
    );
  });
});
