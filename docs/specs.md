# Specification: Real-Time Multiplayer Pixel Board (MVP)

## 1. Executive Summary
A lightweight, zero-auth real-time collaborative canvas where users can draw pixels on a shared $32 \times 32$ grid. Draw actions taken by any connected client are synchronized instantly across all active sessions using WebSockets and Cloudflare Durable Objects.

---

## 2. Technology Stack & Runtimes

* **JavaScript Runtime & Package Manager:** Bun (`bun`, `bunx`)
* **Backend Framework:** Hono (`hono`)
* **Compute Platform:** Cloudflare Workers
* **State & Real-Time Sync:** Cloudflare Durable Objects (using Hibernation WebSocket API)
* **Frontend Library:** React 18 / 19 + TypeScript (Bootstrapped with Vite)
* **Data Fetching:** TanStack Query (`@tanstack/react-query`)
* **Rendering Engine:** HTML5 Canvas API

---

## 3. Functional Specifications

### 3.1 In-Scope (MVP)
1. **Initial Hydration:** When a client opens the application, it fetches the current $32 \times 32$ canvas state via HTTP GET.
2. **Real-Time Sync:** On page load, a WebSocket connection is established to the backend.
3. **Interactive Pixel Placement:** Clicking or dragging over a canvas cell updates the local canvas immediately and emits a WebSocket frame.
4. **Multi-Client Broadcast:** The Durable Object receives the draw payload and broadcasts it to all other connected clients without persisting to disk.
5. **Reconnection Recovery:** Reloading any client re-fetches the live state held in the Durable Object's memory.

### 3.2 Out-Of-Scope (Non-Goals)
* User authentication, sessions, or identity tracking
* Persistent disk storage (D1, SQLite, R2, or KV)
* Anti-griefing cooldown timers or rate limiting
* Smooth vector/Bresenham line interpolation