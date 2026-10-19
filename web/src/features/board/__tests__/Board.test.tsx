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

// A ref and shared mock defined in hoisted so vi.mock can access them
const { webSocketRef, sharedSend, FakeWebSocketClass } = vi.hoisted(() => {
  const ref: { current: null | InstanceType<typeof FakeWebSocket> } = {
    current: null,
  };
  const send = vi.fn();

  class FakeWebSocket extends EventTarget {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static autoOpen = true;

    readonly send = send;
    readonly close = vi.fn();
    readyState = FakeWebSocket.CONNECTING;

    constructor(_url: string | URL) {
      super();
      ref.current = this;
      if (FakeWebSocket.autoOpen) {
        queueMicrotask(() => this.open());
      }
    }

    open() {
      this.readyState = FakeWebSocket.OPEN;
      this.dispatchEvent(new Event("open"));
    }
  }

  return {
    webSocketRef: ref,
    sharedSend: send,
    FakeWebSocketClass: FakeWebSocket,
  };
});

vi.mock("partysocket/ws", () => ({
  default: FakeWebSocketClass,
}));

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
  sharedSend.mockClear();
  FakeWebSocketClass.autoOpen = true;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
    fakeContext as unknown as CanvasRenderingContext2D,
  );
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
    FakeWebSocketClass.autoOpen = false;
    const queryClient = createQueryClient();
    queryClient.setQueryData(["board"], createBlankBoard());

    renderBoard(queryClient);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Board")).toBeNull();
    webSocketRef.current?.open();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/board");
    });
    webSocketRef.current?.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "DRAW",
          x: BOARD_SIZE - 1,
          y: BOARD_SIZE - 1,
          color: "#E50000",
        }),
      }),
    );
    webSocketRef.current?.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ type: "RESET" }) }),
    );
    webSocketRef.current?.dispatchEvent(
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

    webSocketRef.current?.dispatchEvent(
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

    expect(sharedSend).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
    );
    expect(sharedSend).toHaveBeenCalledWith(
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

    expect(sharedSend).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
    );
    expect(sharedSend).toHaveBeenCalledWith(
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

    expect(sharedSend).not.toHaveBeenCalledWith(
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
    expect(sharedSend).toHaveBeenCalledWith(
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

    expect(sharedSend).toHaveBeenCalledWith(
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

    expect(sharedSend).toHaveBeenCalledWith(JSON.stringify({ type: "RESET" }));
    webSocketRef.current?.dispatchEvent(
      new MessageEvent("message", { data: JSON.stringify({ type: "RESET" }) }),
    );

    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#2B2B2B");
    });
  });

  it("reconnects, re-fetches the Board, and replays buffered messages after reconnect", async () => {
    const initialBoard = createBlankBoard();
    initialBoard[BOARD_SIZE - 1][BOARD_SIZE - 1] = "#FFFFFF";
    const reconnectedBoard = createBlankBoard();
    reconnectedBoard[BOARD_SIZE - 1][BOARD_SIZE - 1] = "#E50000";

    let resolveFirstFetch: ((value: Response) => void) | undefined;
    const firstFetch = new Promise<Response>((resolve) => {
      resolveFirstFetch = resolve;
    });

    vi.spyOn(globalThis, "fetch").mockImplementation(() => firstFetch);
    FakeWebSocketClass.autoOpen = false;
    const queryClient = createQueryClient();
    queryClient.setQueryData(["board"], createBlankBoard());

    renderBoard(queryClient);

    // First connection - open, snapshot loads
    webSocketRef.current?.open();
    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/board");
    });

    if (!resolveFirstFetch) {
      throw new Error("The first Board snapshot resolver was not initialized.");
    }
    resolveFirstFetch(Response.json(initialBoard));
    await screen.findByLabelText("Board");
    // The last cell drawn (BOARD_SIZE-1, BOARD_SIZE-1) has #FFFFFF from initialBoard
    expect(fakeContext.fillStyle).toBe("#FFFFFF");

    // Now simulate disconnect + reconnect
    webSocketRef.current?.close();
    if (webSocketRef.current) {
      webSocketRef.current.readyState = FakeWebSocketClass.CONNECTING;
    }

    // Set up second fetch for the reconnection
    let resolveSecondFetch: ((value: Response) => void) | undefined;
    const secondFetch = new Promise<Response>((resolve) => {
      resolveSecondFetch = resolve;
    });
    vi.spyOn(globalThis, "fetch").mockImplementation(() => secondFetch);

    // Reconnect
    webSocketRef.current?.open();

    await waitFor(() => {
      expect(globalThis.fetch).toHaveBeenCalledWith("/api/board");
    });

    // Simulate a message that arrived while re-hydrating after reconnect
    webSocketRef.current?.dispatchEvent(
      new MessageEvent("message", {
        data: JSON.stringify({
          type: "DRAW",
          x: BOARD_SIZE - 1,
          y: BOARD_SIZE - 1,
          color: "#E50000",
        }),
      }),
    );

    if (!resolveSecondFetch) {
      throw new Error(
        "The second Board snapshot resolver was not initialized.",
      );
    }
    resolveSecondFetch(Response.json(reconnectedBoard));

    await waitFor(() => {
      expect(fakeContext.fillStyle).toBe("#E50000");
    });
  });

  it("sends draws while the socket is disconnected — partysocket handles buffering", async () => {
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

    // Draw at a known location — same pattern as the DRAW test above
    fireEvent.pointerDown(canvas, { clientX: 2 * 16 + 1, clientY: 3 * 16 + 1 });

    expect(sharedSend).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 2, y: 3, color: "#FFFFFF" }),
    );

    // Simulate disconnection
    const callsBeforeDisconnect = sharedSend.mock.calls.length;
    webSocketRef.current?.close();
    if (webSocketRef.current) {
      webSocketRef.current.readyState = FakeWebSocketClass.CONNECTING;
    }

    // Draw while disconnected
    fireEvent.pointerDown(canvas, { clientX: 3 * 16 + 1, clientY: 3 * 16 + 1 });

    // Send was still attempted
    expect(sharedSend).toHaveBeenCalledTimes(callsBeforeDisconnect + 1);
    expect(sharedSend).toHaveBeenCalledWith(
      JSON.stringify({ type: "DRAW", x: 3, y: 3, color: "#FFFFFF" }),
    );
  });
});
