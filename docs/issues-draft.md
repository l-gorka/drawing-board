=== OPTION 2: COPY-PASTE EACH INTO GITHUB WEB UI ===

--- ISSUE 1 ---
TITLE: feat: Initialize Hono backend and React frontend with Bun
BODY:
Set up the project workspace using Bun as package manager and runner.

Tasks:
- [ ] Create Hono backend on Cloudflare Workers: `bun create hono backend --template cloudflare-workers`
- [ ] Create React + TypeScript frontend with Vite: `bun create vite frontend --template react-ts`
- [ ] Install TanStack Query in frontend: `cd frontend && bun add @tanstack/react-query`
- [ ] Verify `bunx wrangler dev` runs the backend locally at http://localhost:8787.


--- ISSUE 2 ---
TITLE: feat(backend): Set up Durable Object class and wrangler bindings
BODY:
Configure Wrangler to bind a Durable Object class to handle persistent WebSocket connections.

Tasks:
- [ ] Update `wrangler.jsonc` in `backend/` to include DO bindings
- [ ] Create `BoardDO` class using WebSocket Hibernation (`this.ctx.acceptWebSocket(server)`).
- [ ] Implement `webSocketMessage` hook to broadcast incoming data to all active sockets.


--- ISSUE 3 ---
TITLE: feat(backend): Implement Hono WebSocket upgrade route and board state
BODY:
Build the HTTP/WebSocket endpoints and store the 32x32 canvas state in the Durable Object.

Tasks:
- [ ] Initialize 32x32 2D array in `BoardDO` memory defaulted to `#ffffff`.
- [ ] Expose `GET /api/board` to fetch current canvas state as JSON.
- [ ] Expose `GET /ws` route in Hono to route WebSocket upgrade requests directly to `BOARD_DO`.
- [ ] Verify local WebSocket connection via CLI (`bunx wscat -c ws://localhost:8787/ws`).


--- ISSUE 4 ---
TITLE: feat(frontend): Build interactive HTML5 pixel grid canvas
BODY:
Build the client-side canvas component with drawing controls.

Tasks:
- [ ] Create `<CanvasBoard />` component with fixed 32x32 grid resolution.
- [ ] Add mouse event handlers (`mousedown`, `mousemove`, `mouseup`) to draw pixels locally.
- [ ] Add color picker inputs or preset color palette selector.


--- ISSUE 5 ---
TITLE: feat(frontend): Implement real-time WebSocket sync with TanStack Query
BODY:
Wire up initial state loading and live WebSocket broadcasts.

Tasks:
- [ ] Use TanStack Query to fetch initial board state from `GET /api/board` on app load.
- [ ] Open WebSocket connection to `ws://localhost:8787/ws` inside React `useEffect`.
- [ ] Send payload `{ type: "DRAW", x, y, color }` on pixel click/drag.
- [ ] Receive incoming WebSocket draw events and update local canvas state in real time.


--- ISSUE 6 ---
TITLE: test: Verify multi-window real-time synchronization
BODY:
Ensure two separate browser instances stay completely in sync.

Tasks:
- [ ] Open two browser windows pointing to `http://localhost:5173`.
- [ ] Draw on Window A and verify pixels immediately paint on Window B.
- [ ] Reload Window B and verify it rehydrates the exact current state from the Durable Object.