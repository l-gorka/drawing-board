# Specification: Real-Time Multiplayer Pixel Board (MVP)

Vocabulary follows [`GLOSSARY.md`](../../GLOSSARY.md).

## 1. Executive Summary

A lightweight, zero-auth real-time collaborative pixel board. Anyone who opens the app can Draw on a single shared 32 × 32 Board and see every other participant's Draws instantly. Draw actions are synchronized across all connected clients using WebSockets and a Cloudflare Durable Object, which also stores the Board.

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

* `server/`: Hono Worker and the `BoardDO` Durable Object
* `web/`: React + Vite client
* `shared/`: message types, validation, and the Palette, imported by both `server/` and `web/`

### 2.2 Topology

* **Single Board:** exactly one Durable Object instance, addressed by the name `"main"`.
* **Development:** the Vite dev server proxies `/api` and `/ws` to the Worker on `:8787`. Client code uses relative URLs only (no hardcoded host or port).
* **Production:** one Worker serves the built frontend as static assets and handles `/api` and `/ws` on the same origin. Deployment is manual (`wrangler deploy`).

---

## 3. Functional Specifications

### 3.1 In-Scope (MVP)

1. **Initial Hydration:** On load, the client fetches the current Board via `GET /api/board` (TanStack Query).
2. **Real-Time Sync:** On load, the client opens a WebSocket to `/ws`.
3. **Hydration without lost Draws:** The client opens the WebSocket first and buffers incoming Draws. It then loads the Board snapshot, applies it, and replays the buffered Draws on top.
4. **Interactive Drawing:** Clicking or dragging over a Cell updates the Canvas immediately (optimistic) and sends a `DRAW` message.
5. **Server-authoritative Board:** `BoardDO` applies each valid `DRAW` to its Board, persists it, and broadcasts it to all other connected clients.
6. **Validation:** `BoardDO` accepts a `DRAW` only if `x` and `y` are integers in 0–31 and `color` is a member of the Palette. Anything else is silently dropped. All other messages with an unknown `type` are dropped.
7. **Palette:** Participants choose from a fixed Palette (16 colors, defined once in `shared/`). The Blank color (dark gray) is part of the Palette and acts as the eraser. There is no free color picker.
8. **Reset:** A Reset button sets every Cell to the Blank color for everyone. Any visitor can press it, with no confirmation dialog. `BoardDO` clears and persists the Board, then broadcasts `RESET` to all connected clients, including the sender.
9. **Persistence across hibernation and reloads:** The Board survives Durable Object hibernation, eviction, and page reloads. A reloaded client re-fetches the Board from `GET /api/board`.
10. **Reconnection and resync:** When the WebSocket connection drops (device sleep, network blip, deploy), the client reconnects automatically with backoff, re-fetches the Board from `GET /api/board`, and replays messages received during the fetch on top of the snapshot. Draws and Resets made while disconnected are delivered in order once the connection is re-established. Returning to a suspended tab also re-fetches the Board.
11. **Deployment:** The app can be built and deployed as a single Worker serving the frontend and the API.

### 3.2 Messages

Client to server:

* `{ "type": "DRAW", "x": number, "y": number, "color": string }`
* `{ "type": "RESET" }`

Server to client (broadcast):

* `{ "type": "DRAW", "x": number, "y": number, "color": string }`: sent to all clients except the sender
* `{ "type": "RESET" }`: sent to all clients

### 3.3 HTTP API

* `GET /api/board`: returns the current Board as JSON (32 × 32 colors).
* `GET /ws`: WebSocket upgrade, routed to the `"main"` `BoardDO`.

### 3.4 Out-Of-Scope (Non-Goals)

* User authentication, sessions, or identity tracking
* External databases or storage services (D1, R2, KV)
* Anti-griefing cooldown timers, rate limiting, or access control on Reset
* Smooth vector/Bresenham line interpolation
* An app-level ping/pong heartbeat to detect a silently dead WebSocket that still reports `OPEN`
* Multiple Boards
* Free color picker
