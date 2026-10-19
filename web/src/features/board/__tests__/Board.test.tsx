import { BOARD_SIZE, createBlankBoard, Palette } from "@drawing-board/shared";
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
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static autoOpen = true;
  static instances: FakeWebSocket[] = [];

  readonly send = vi.fn();
  readonly close = vi.fn(() => {
    this.readyState = FakeWebSocket.CLOSED;
  });
  readyState = FakeWebSocket.CONNECTING;

  constructor(_url: string | URL) {
    super();
    FakeWebSocket.instances.push(this);
    webSocket = this;
    if (FakeWebSocket.autoOpen) {
      queueMicrotask(() => this.open());
    }
  }

  open() {
    if (this.readyState !== FakeWebSocket.CONNECTING) {
      return;
    }
    this.readyState = FakeWebSocket.OPEN;
    this.dispatchEvent(new Event("open"));
  }

  /** Simulates an unexpected drop: the socket closes without a deliberate teardown. */
  drop() {
    this.readyState = FakeWebSocket.CLOSED;
    this.dispatchEvent(new Event("close"));
  }
}

let webSocket: FakeWebSocket;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function renderBoard(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Board />
    </QueryClientProvider>,
  );
}

function renderBoardInStrictMode(queryClient = createQueryClient()) {
  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <Board />
      </QueryClientProvider>
    </StrictMode>,
  );
}

beforeEach(() => {
  fakeContext.fillRect.mockClear();
  FakeWebSocket.autoOpen = true;
  FakeWebSocket.instances = [];
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

    renderBoard();

    await waitFor(() => {
      expect(FakeWebSocket.instances).toHaveLength(1);
    });
    webSocket = FakeWebSocket.instances[0];
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Board")).toBeNull();
    act(() => {
      webSocket.open();
    });
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
    const resolve = resolveSnapshot;
    act(() => {
      resolve(Response.json(createBlankBoard()));
    });

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

  it("reconnects and re-hydrates the Board after a dropped connection", async () => {
    const drawnBoard = createBlankBoard();
    drawnBoard[BOARD_SIZE - 1][BOARD_SIZE - 1] = "#E50000";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(createBlankBoard()))
      .mockResolvedValueOnce(Response.json(drawnBoard));

    renderBoard();

    await screen.findByLabelText("Board");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      webSocket.drop();
    });

    // partysocket reconnects only after its initial backoff delay elapses.
    await waitFor(
      () => {
        expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
      },
      { timeout: 4000 },
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#E50000");
    });
  });

  it("re-hydrates a Board that changed while the tab was suspended", async () => {
    const changedBoard = createBlankBoard();
    changedBoard[BOARD_SIZE - 1][BOARD_SIZE - 1] = "#E50000";
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(createBlankBoard()))
      .mockResolvedValueOnce(Response.json(changedBoard));

    renderBoard();

    await screen.findByLabelText("Board");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fakeContext.fillStyle).toBe("#2B2B2B");

    // jsdom reports "visible"; backgrounding then returning simulates a
    // suspended tab whose Board moved on, and must re-fetch the snapshot.
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#E50000");
    });
  });

  it("applies a snapshot that changed while disconnected", async () => {
    const changedBoard = createBlankBoard();
    changedBoard[BOARD_SIZE - 1][BOARD_SIZE - 1] = "#E50000";
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(Response.json(createBlankBoard()))
      .mockResolvedValueOnce(Response.json(changedBoard));

    renderBoard();

    await screen.findByLabelText("Board");
    expect(fakeContext.fillStyle).toBe("#2B2B2B");

    act(() => {
      webSocket.drop();
    });

    await waitFor(
      () => {
        expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
      },
      { timeout: 4000 },
    );

    // Even if no broadcast was missed, the snapshotted Draw is rendered.
    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#E50000");
    });
  });

  it("delivers Draws made while disconnected once reconnected", async () => {
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
    act(() => {
      webSocket.drop();
    });

    // Drawn while the connection is down: partysocket buffers the message.
    fireEvent.pointerDown(canvas, { clientX: 2 * 16 + 1, clientY: 3 * 16 + 1 });

    await waitFor(
      () => {
        expect(FakeWebSocket.instances.length).toBeGreaterThan(1);
      },
      { timeout: 4000 },
    );
    const reconnected = FakeWebSocket.instances.at(-1);
    if (!reconnected) {
      throw new Error("The reconnected WebSocket was not created.");
    }

    await waitFor(() => {
      expect(reconnected.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
      );
    });
  });

  it("does not reconnect after an unmount", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(createBlankBoard()),
    );

    const view = renderBoard();

    await screen.findByLabelText("Board");
    const { close } = webSocket;
    const socketsBeforeUnmount = FakeWebSocket.instances.length;

    view.unmount();

    expect(close).toHaveBeenCalled();
    // Give any pending partysocket backoff a chance to fire a reconnect.
    await new Promise((resolve) => setTimeout(resolve, 4000));
    expect(FakeWebSocket.instances).toHaveLength(socketsBeforeUnmount);
  });

  it("guards against duplicate sockets under StrictMode", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(createBlankBoard()),
    );

    renderBoardInStrictMode();

    await screen.findByLabelText("Board");
    // The StrictMode double-invoke remounts the effect; exactly one socket
    // remains open, and the live connection is the one exposed to the UI.
    const openSockets = FakeWebSocket.instances.filter(
      (instance) => instance.readyState === FakeWebSocket.OPEN,
    );
    expect(openSockets).toHaveLength(1);
    expect(openSockets[0]).toBe(FakeWebSocket.instances.at(-1));
  });
});
