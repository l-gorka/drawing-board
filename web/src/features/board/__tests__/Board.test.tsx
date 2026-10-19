import {
  BOARD_SIZE,
  type Color,
  createBlankBoard,
  Palette,
} from "@drawing-board/shared";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { StrictMode } from "react";
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
  static readonly CLOSED = 3;
  static autoOpen = true;

  readonly send = vi.fn();
  readonly close = vi.fn();
  readyState = FakeWebSocket.CONNECTING;

  constructor(_url: string | URL) {
    super();
    webSocket = this;
    webSockets.push(this);
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

let webSocket: FakeWebSocket;
let webSockets: FakeWebSocket[] = [];

async function waitForWebSocketCount(count: number): Promise<FakeWebSocket> {
  await waitFor(() => {
    expect(webSockets).toHaveLength(count);
  });
  return webSockets[count - 1];
}

function receive(socket: FakeWebSocket, message: unknown): void {
  socket.dispatchEvent(
    new MessageEvent("message", { data: JSON.stringify(message) }),
  );
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
  webSockets = [];
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
    (await waitForWebSocketCount(1)).open();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/board");
    });
    webSocket.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "DRAW",
          x: BOARD_SIZE - 1,
          y: BOARD_SIZE - 1,
          color: "#E50000",
        }),
      }),
    );
    webSocket.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ type: "RESET" }) }),
    );
    webSocket.dispatchEvent(
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

    webSocket.dispatchEvent(
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

    expect(webSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
    );
    expect(webSocket.send).toHaveBeenCalledWith(
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

    expect(webSocket.send).not.toHaveBeenCalledWith(
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
    expect(webSocket.send).toHaveBeenCalledWith(
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

    expect(webSocket.send).toHaveBeenCalledWith(
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

    expect(webSocket.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "RESET" }),
    );
    webSocket.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ type: "RESET" }) }),
    );

    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#2B2B2B");
    });
  });

  describe("when the WebSocket connection drops", () => {
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

    function boardWithLastCell(color: Color) {
      const board = createBlankBoard();
      board[BOARD_SIZE - 1][BOARD_SIZE - 1] = color;
      return board;
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    async function dropAndWaitForReconnect(): Promise<FakeWebSocket> {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      webSockets[0].drop();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      vi.useRealTimers();
      return webSockets[1];
    }

    it("reconnects with backoff, re-hydrates the Board and delivers queued Draws in order", async () => {
      const fetchMock = vi
        .spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(Response.json(createBlankBoard()))
        .mockResolvedValueOnce(Response.json(boardWithLastCell("#E50000")));
      vi.spyOn(
        HTMLCanvasElement.prototype,
        "getBoundingClientRect",
      ).mockReturnValue(bounds);

      renderBoard();

      const canvas = await screen.findByLabelText<HTMLCanvasElement>("Board");
      expect(fakeContext.fillStyle).toBe("#2B2B2B");

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      webSockets[0].drop();
      fireEvent.pointerDown(canvas, { clientX: 1, clientY: 1 });
      fireEvent.pointerMove(canvas, { clientX: 17, clientY: 1 });
      fireEvent.click(screen.getByRole("button", { name: "Reset" }));

      expect(webSockets).toHaveLength(1);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      vi.useRealTimers();

      expect(webSockets).toHaveLength(2);
      expect(webSockets[1].send.mock.calls).toEqual([
        [JSON.stringify({ type: "DRAW", x: 0, y: 0, color: "#FFFFFF" })],
        [JSON.stringify({ type: "DRAW", x: 1, y: 0, color: "#FFFFFF" })],
        [JSON.stringify({ type: "RESET" })],
      ]);
      await waitFor(() => {
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fakeContext.fillStyle).toBe("#E50000");
      });
    });

    it("does not reconnect after the Board is torn down", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        Response.json(createBlankBoard()),
      );

      renderBoard();
      await screen.findByLabelText("Board");

      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      cleanup();
      webSockets[0].drop();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(webSockets).toHaveLength(1);
    });

    it("replays messages received while the Board is re-hydrated", async () => {
      let resolveSnapshot: ((value: Response) => void) | undefined;
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(Response.json(createBlankBoard()))
        .mockReturnValueOnce(
          new Promise<Response>((resolve) => {
            resolveSnapshot = resolve;
          }),
        );

      renderBoard();
      await screen.findByLabelText("Board");

      const reconnected = await dropAndWaitForReconnect();
      await waitFor(() => {
        expect(globalThis.fetch).toHaveBeenCalledTimes(2);
      });

      receive(reconnected, {
        type: "DRAW",
        x: BOARD_SIZE - 1,
        y: BOARD_SIZE - 1,
        color: "#E50000",
      });
      receive(reconnected, { type: "RESET" });
      receive(reconnected, {
        type: "DRAW",
        x: BOARD_SIZE - 1,
        y: BOARD_SIZE - 1,
        color: "#0083C7",
      });
      if (!resolveSnapshot) {
        throw new Error("The Board snapshot resolver was not initialized.");
      }
      resolveSnapshot(Response.json(createBlankBoard()));

      await waitFor(() => {
        expect(fakeContext.fillStyle).toBe("#0083C7");
      });
      expect(screen.queryByText("Loading the Board…")).toBeNull();
    });

    it("keeps the last Board and retries when the re-hydration fails", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(Response.json(createBlankBoard()))
        .mockResolvedValueOnce(new Response("nope", { status: 500 }))
        .mockResolvedValue(Response.json(boardWithLastCell("#E50000")));

      renderBoard();
      await screen.findByLabelText("Board");

      await dropAndWaitForReconnect();

      await waitFor(() => {
        expect(fakeContext.fillStyle).toBe("#E50000");
      });
      expect(globalThis.fetch).toHaveBeenCalledTimes(3);
      expect(screen.queryByText("Could not load the Board.")).toBeNull();
    });

    it("re-hydrates the Board when a suspended tab becomes visible again", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(Response.json(createBlankBoard()))
        .mockResolvedValueOnce(Response.json(boardWithLastCell("#E50000")));

      renderBoard();
      await screen.findByLabelText("Board");
      expect(fakeContext.fillStyle).toBe("#2B2B2B");

      document.dispatchEvent(new Event("visibilitychange"));

      await waitFor(() => {
        expect(fakeContext.fillStyle).toBe("#E50000");
      });
      expect(webSockets).toHaveLength(1);
    });

    it("re-hydrates the Board when the page is restored from the back/forward cache", async () => {
      vi.spyOn(globalThis, "fetch")
        .mockResolvedValueOnce(Response.json(createBlankBoard()))
        .mockResolvedValueOnce(Response.json(boardWithLastCell("#E50000")));

      renderBoard();
      await screen.findByLabelText("Board");

      window.dispatchEvent(new PageTransitionEvent("pageshow"));
      expect(globalThis.fetch).toHaveBeenCalledTimes(1);
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true }),
      );

      await waitFor(() => {
        expect(fakeContext.fillStyle).toBe("#E50000");
      });
    });
  });

  it("opens a single WebSocket under React StrictMode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(createBlankBoard()),
    );

    render(
      <StrictMode>
        <QueryClientProvider client={createQueryClient()}>
          <Board />
        </QueryClientProvider>
      </StrictMode>,
    );

    await screen.findByLabelText("Board");
    expect(webSockets).toHaveLength(1);
  });
});
