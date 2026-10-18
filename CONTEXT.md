# Repository context

A real-time multiplayer pixel board: a zero-auth shared 32×32 Board that anyone can Draw on, synchronized live over WebSockets by a Cloudflare Durable Object.

The repository contains:

- `server/` — Hono Worker and the `BoardDO` Durable Object.
- `web/` — React + Vite client that renders the Board on a Canvas.
- `shared/` — message types, validation and the Palette, used by both `server/` and `web/`.
- `docs/` — specifications and (later) ADRs and knowledge notes.
- `.ai-kit/` — agent workflow kit (git submodule); not product code.

## Documentation map

- `GLOSSARY.md` — canonical shared product and domain vocabulary.
- `docs/specs/` — desired user-facing behavior and integration capabilities.
- `docs/adr/` — durable architectural trade-offs and their rationale.
- `docs/knowledge/` — verified, reusable solutions to recurring problems.

When sources conflict, use the glossary for terminology, the specifications
for desired behavior, ADRs for architectural rationale, and the current issue
for task scope. Record unresolved specification/implementation mismatches as
explicit follow-up work.

## Verification commands

The agent workflow reads this section for the baseline checks to run before
handoff.

Run from the repository root. Each root command runs the matching script in
every workspace (`bun run test`, `bun run lint`, `bun run typecheck`,
`bun run build`).

```text
shared: bun run --cwd shared test
shared: bun run --cwd shared lint
shared: bun run --cwd shared typecheck
shared: bun run --cwd shared build
server: bun run --cwd server test
server: bun run --cwd server lint
server: bun run --cwd server typecheck
server: bun run --cwd server build
web: bun run --cwd web test
web: bun run --cwd web lint
web: bun run --cwd web typecheck
web: bun run --cwd web build
```

Tests run on Vitest and linting on Biome. `server` tests run inside
Cloudflare's Worker runtime. `bun run dev` starts the Worker (:8787) and the
web app (:5173).

## Project conventions

Rules the agent workflow applies in step 6 of implementation mode, for example
shared-component usage, test file locations, or module boundaries.

- Runtime and package manager is Bun (`bun`, `bunx`); do not use npm, yarn or pnpm.
- The wire protocol (messages, validation, Palette) is defined only in `shared/`; `server/` and `web/` import it and never redefine it.
- Client code uses relative URLs (`/api`, `/ws`); never hardcode a host or port.
