import { BOARD_SIZE, createBlankBoard, Palette } from "@drawing-board/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
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
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static autoOpen = true;

  readonly send = vi.fn();
  readonly close = vi.fn(() => this.drop());
  readyState = FakeWebSocket.CONNECTING;

  constructor(_url: string | URL) {
    super();
    webSocket = this;
    if (FakeWebSocket.autoOpen) {
      queueMicrotask(() => this.open());
    }
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

let webSocket: FakeWebSocket | null = null;

function currentWebSocket(): FakeWebSocket {
  if (!webSocket) {
    throw new Error("Expected a WebSocket connection.");
  }
  return webSocket;
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderBoard(queryClient = createQueryClient()) {
  render(
    <QueryClientProvider client={queryClient}>
      <Board />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  fakeContext.fillRect.mockClear();
  FakeWebSocket.autoOpen = true;
  webSocket = null;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    fakeContext as unknown as CanvasRenderingContext2D,
  );
  vi.stubGlobal("WebSocket", FakeWebSocket);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
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
    await waitFor(() => {
      expect(fakeContext.fillRect).toHaveBeenCalledTimes(
        BOARD_SIZE * BOARD_SIZE,
      );
    });
  });

  it("replays messages received while the Board snapshot loads", async () => {
    let resolveSnapshot: ((value: Response) => void) | undefined;
    const snapshot = new Promise<Response>((resolve) => {
      resolveSnapshot = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockReturnValue(snapshot);
    FakeWebSocket.autoOpen = false;
    const queryClient = createQueryClient();
    queryClient.setQueryData(["board"], createBlankBoard());

    renderBoard(queryClient);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Board")).toBeNull();
    await Promise.resolve();
    await waitFor(() => {
      expect(webSocket).not.toBeNull();
    });
    currentWebSocket().open();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/board");
    });
    currentWebSocket().dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "DRAW",
          x: BOARD_SIZE - 1,
          y: BOARD_SIZE - 1,
          color: "#E50000",
        }),
      }),
    );
    currentWebSocket().dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ type: "RESET" }) }),
    );
    currentWebSocket().dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "DRAW",
          x: BOARD_SIZE - 1,
          y: BOARD_SIZE - 1,
          color: "#0083C7",
        }),
      }),
    );
    if (!resolveSnapshot) {
      throw new Error("The Board snapshot resolver was not initialized.");
    }
    resolveSnapshot(Response.json(createBlankBoard()));

    await screen.findByLabelText("Board");
    expect(fakeContext.fillStyle).toBe("#0083C7");

    currentWebSocket().dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "DRAW",
          x: BOARD_SIZE - 1,
          y: BOARD_SIZE - 1,
          color: "#02BE01",
        }),
      }),
    );

    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#02BE01");
    });
  });

  it("reconnects and rehydrates the Board after a dropped connection", async () => {
    let resolveReconnectedSnapshot: ((value: Response) => void) | undefined;
    const reconnectedSnapshot = new Promise<Response>((resolve) => {
      resolveReconnectedSnapshot = resolve;
    });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(createBlankBoard()))
      .mockReturnValueOnce(reconnectedSnapshot);
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      bottom: CANVAS_SIZE,
      height: CANVAS_SIZE,
      left: 0,
      right: CANVAS_SIZE,
      top: 0,
      width: CANVAS_SIZE,
      x: 0,
      y: 0,
      toJSON: () => "",
    });

    renderBoard();

    const canvas = await screen.findByLabelText("Board");
    const initialSocket = currentWebSocket();
    vi.useFakeTimers();
    initialSocket.drop();
    fireEvent.pointerDown(canvas, { clientX: 1, clientY: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    await vi.advanceTimersByTimeAsync(10_000);
    await Promise.resolve();
    vi.useRealTimers();

    const reconnectedSocket = currentWebSocket();
    expect(reconnectedSocket).not.toBe(initialSocket);
    expect(reconnectedSocket.send).toHaveBeenNthCalledWith(
      1,
      JSON.stringify({ type: "DRAW", x: 0, y: 0, color: "#FFFFFF" }),
    );
    expect(reconnectedSocket.send).toHaveBeenNthCalledWith(
      2,
      JSON.stringify({ type: "RESET" }),
    );
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    reconnectedSocket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "DRAW",
          x: BOARD_SIZE - 1,
          y: BOARD_SIZE - 1,
          color: "#E50000",
        }),
      }),
    );
    if (!resolveReconnectedSnapshot) {
      throw new Error("The reconnected snapshot resolver was not initialized.");
    }
    resolveReconnectedSnapshot(Response.json(createBlankBoard()));

    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#E50000");
    });
  });

  it("shows a loading spinner while the Board loads", async () => {
    let resolveSnapshot: ((value: Response) => void) | undefined;
    const snapshot = new Promise<Response>((resolve) => {
      resolveSnapshot = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockReturnValue(snapshot);

    renderBoard();

    const loading = screen.getByRole("status", { name: /loading the board/i });
    expect(loading.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByText("Loading the Board…")).toBeTruthy();
    expect(document.querySelector(".board-loading-spinner")).toBeTruthy();
    expect(screen.queryByLabelText("Board")).toBeNull();

    if (!resolveSnapshot) {
      throw new Error("The Board snapshot resolver was not initialized.");
    }
    resolveSnapshot(Response.json(createBlankBoard()));

    await screen.findByLabelText("Board");
    expect(screen.queryByRole("status", { name: /loading the board/i })).toBeNull();
  });

  it("shows an error message when the Board cannot be loaded", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 }),
    );

    renderBoard();

    expect(await screen.findByText("Could not load the Board.")).toBeTruthy();
    expect(screen.queryByRole("status", { name: /loading the board/i })).toBeNull();
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

    expect(currentWebSocket().send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
    );
    expect(currentWebSocket().send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 3, y: 3, color: "#FFFFFF" }),
    );
  });

  it("sends DRAW messages for touch taps and drags", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(createBlankBoard()),
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      bottom: CANVAS_SIZE,
      height: CANVAS_SIZE,
      left: 0,
      right: CANVAS_SIZE,
      top: 0,
      width: CANVAS_SIZE,
      x: 0,
      y: 0,
      toJSON: () => "",
    });

    renderBoard();

    const canvas = await screen.findByLabelText<HTMLCanvasElement>("Board");
    expect(canvas.className).toBe("board-canvas");
    const touchDown = createEvent.pointerDown(canvas, {
      clientX: 2 * 16 + 1,
      clientY: 3 * 16 + 1,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent(canvas, touchDown);
    expect(touchDown.defaultPrevented).toBe(true);
    fireEvent.pointerMove(canvas, {
      clientX: 3 * 16 + 1,
      clientY: 3 * 16 + 1,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(currentWebSocket().send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
    );
    expect(currentWebSocket().send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 3, y: 3, color: "#FFFFFF" }),
    );

    fireEvent.pointerCancel(canvas, {
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(canvas, {
      clientX: 4 * 16 + 1,
      clientY: 3 * 16 + 1,
      pointerId: 1,
      pointerType: "touch",
    });

    expect(currentWebSocket().send).not.toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 4, y: 3, color: "#FFFFFF" }),
    );

    const penDown = createEvent.pointerDown(canvas, {
      clientX: 5 * 16 + 1,
      clientY: 3 * 16 + 1,
      pointerId: 2,
      pointerType: "pen",
    });
    fireEvent(canvas, penDown);
    expect(penDown.defaultPrevented).toBe(true);
    expect(currentWebSocket().send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 5, y: 3, color: "#FFFFFF" }),
    );
  });

  it("draws with the selected Palette color", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(createBlankBoard()),
    );
    vi.spyOn(
      HTMLCanvasElement.prototype,
      "getBoundingClientRect",
    ).mockReturnValue({
      bottom: CANVAS_SIZE,
      height: CANVAS_SIZE,
      left: 0,
      right: CANVAS_SIZE,
      top: 0,
      width: CANVAS_SIZE,
      x: 0,
      y: 0,
      toJSON: () => "",
    });

    renderBoard();

    const selectedColor = await screen.findByRole("button", {
      name: "Select #E50000",
    });
    expect(
      within(screen.getByRole("group", { name: "Palette" })).getAllByRole(
        "button",
      ),
    ).toHaveLength(Palette.length);
    expect(
      screen
        .getByRole("button", { name: "Select #FFFFFF" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(selectedColor.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(selectedColor);

    expect(selectedColor.getAttribute("aria-pressed")).toBe("true");

    const canvas = screen.getByLabelText<HTMLCanvasElement>("Board");
    fireEvent.pointerDown(canvas, { clientX: 1, clientY: 1 });

    expect(currentWebSocket().send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 0, y: 0, color: "#E50000" }),
    );
  });

  it("sends RESET and renders the Reset broadcast", async () => {
    const drawnBoard = createBlankBoard();
    drawnBoard[BOARD_SIZE - 1][BOARD_SIZE - 1] = "#E50000";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json(drawnBoard));

    renderBoard();

    await screen.findByLabelText("Board");
    expect(fakeContext.fillStyle).toBe("#E50000");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    expect(currentWebSocket().send).toHaveBeenCalledWith(
      JSON.stringify({ type: "RESET" }),
    );
    currentWebSocket().dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ type: "RESET" }) }),
    );

    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#2B2B2B");
    });
  });
});
