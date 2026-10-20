# Specification: Real-Time Multiplayer Pixel Board (MVP)

Vocabulary follows [`GLOSSARY.md`](../../GLOSSARY.md).

## 1. Executive Summary

A lightweight, zero-auth real-time collaborative pixel board. Anyone who opens the app can Draw on a shared 32 × 32 Board and see every other participant's Draws on that Board instantly. The app supports multiple named Boards; each Board is an independent grid with the same Draw, Reset, Palette, and sync rules. Draw actions are synchronized across all connected clients on a Board using WebSockets and Cloudflare Durable Objects, which also store each Board's grid.

---

## 2. Technology Stack & Runtimes

* **JavaScript Runtime & Package Manager:** Bun (`bun`, `bunx`), using Bun workspaces
* **Backend Framework:** Hono (`hono`)
* **Compute Platform:** Cloudflare Workers
* **State & Real-Time Sync:** Cloudflare Durable Objects (Hibernation WebSocket API), with the Board persisted in the Durable Object's own storage (`ctx.storage`)
* **Frontend Library:** React 18 / 19 + TypeScript (bootstrapped with Vite)
* **Data Fetching:** TanStack Query (`@tanstack/react-query`)
* **Rendering Engine:** HTML5 Canvas API

### 2.1 Repository Layout

* `server/`: Hono Worker, one `BoardDO` per Board id, and a `BoardCatalogDO` for board metadata
* `web/`: React + Vite client
* `shared/`: message types, validation, and the Palette, imported by both `server/` and `web/`

### 2.2 Topology

* **Multiple Boards:** each Board has a stable id. Its grid lives in a dedicated `BoardDO` instance addressed by that id (`getByName(boardId)`). A singleton `BoardCatalogDO` stores the list of boards (id + display name). The default board id is `"main"` (display name `"Main"`), seeded on first catalog load so existing deployments keep the same grid.
* **Duplicate display names:** allowed; ids are unique (new boards get a random UUID).
* **Development:** the Vite dev server proxies `/api` and `/ws` to the Worker on `:8787`. Client code uses relative URLs only (no hardcoded host or port).
* **Production:** one Worker serves the built frontend as static assets and handles `/api` and `/ws` on the same origin. Deployment is manual (`wrangler deploy`).

---

## 3. Functional Specifications

### 3.1 In-Scope (MVP)

1. **Initial Hydration:** On load, the client fetches the active Board snapshot via `GET /api/board/:boardId` (TanStack Query). `GET /api/board` remains an alias for the `"main"` board.
2. **Real-Time Sync:** On load, the client opens a WebSocket to `/ws/:boardId`. `GET /ws` remains an alias for `"main"`.
3. **Hydration without lost Draws:** The client opens the WebSocket first and buffers incoming Draws. It then loads the Board snapshot, applies it, and replays the buffered Draws on top.
4. **Interactive Drawing:** Clicking or dragging over a Cell updates the Canvas immediately (optimistic) and sends a `DRAW` message.
5. **Server-authoritative Board:** `BoardDO` applies each valid `DRAW` to its Board, persists it, and broadcasts it to all other connected clients.
6. **Validation:** `BoardDO` accepts a `DRAW` only if `x` and `y` are integers in 0–31 and `color` is a member of the Palette. Anything else is silently dropped. All other messages with an unknown `type` are dropped.
7. **Palette:** Participants choose from a fixed Palette (16 colors, defined once in `shared/`). The Blank color (dark gray) is part of the Palette and acts as the eraser. There is no free color picker.
8. **Reset:** A Reset button sets every Cell to the Blank color for everyone. Any visitor can press it, with no confirmation dialog. `BoardDO` clears and persists the Board, then broadcasts `RESET` to all connected clients, including the sender.
9. **Persistence across hibernation and reloads:** Each Board survives its Durable Object hibernation, eviction, and page reloads. A reloaded client re-fetches that Board from `GET /api/board/:boardId`.
10. **Board list and creation:** `GET /api/boards` returns known boards (id and name). `POST /api/boards` with `{ "name": string }` creates a board with a non-empty trimmed name. Only catalog-listed board ids may be loaded or joined over WebSocket; unknown ids return 404.
11. **Board switcher (web):** The UI shows the active board name, lets the user pick another board from the list, and create a new named board then switch to it. Switching boards reconnects WebSocket and snapshot hydration for the new id without applying Draws from the previous board.
12. **Deployment:** The app can be built and deployed as a single Worker serving the frontend and the API.

### 3.2 Messages

Client to server:

* `{ "type": "DRAW", "x": number, "y": number, "color": string }`
* `{ "type": "RESET" }`

Server to client (broadcast):

* `{ "type": "DRAW", "x": number, "y": number, "color": string }`: sent to all connected clients, including the sender
* `{ "type": "RESET" }`: sent to all clients

### 3.3 HTTP API

* `GET /api/boards`: returns `{ "boards": [{ "id": string, "name": string }, ...] }`.
* `POST /api/boards`: body `{ "name": string }`; creates a board; responds `201` with `{ "id", "name" }`; `400` if the name is missing or whitespace-only.
* `GET /api/board`: returns the `"main"` board grid (backward compatible).
* `GET /api/board/:boardId`: returns that board's grid; `404` if the id is not in the catalog.
* `GET /ws`: WebSocket upgrade for `"main"`.
* `GET /ws/:boardId`: WebSocket upgrade for the given board; `404` if not catalog-listed.

### 3.4 Out-Of-Scope (Non-Goals)

* User authentication, sessions, or identity tracking
* External databases or storage services (D1, R2, KV)
* Anti-griefing cooldown timers, rate limiting, or access control on Reset
* Smooth vector/Bresenham line interpolation
* Application-level WebSocket ping/pong heartbeats for detecting a connection
  that still reports as open but cannot send or receive data
* Renaming or deleting boards
* Free color picker
