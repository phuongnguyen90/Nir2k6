# Architecture

## Overview
Monorepo (npm workspaces) with four packages sharing one typed contract.

- `@hearth/shared` — DTOs, zod schemas, REST route constants, WS message protocol. Source of truth.
- `@hearth/server` — Fastify + better-sqlite3. Auth, registry, rules/schedules, ingest, WS hub,
  content analysis, notifications.
- `@hearth/dashboard` — React + Vite parent UI.
- `@hearth/agent-desktop` — cross-platform Node agent with per-OS adapters.

## Data model (SQLite)
`parents` · `children` · `devices` · `device_tokens` · `rules` · `schedules` ·
`activity_events` · `captures` · `alerts`. Foreign keys cascade from parent → child → device.

## Policy flow
1. Parent edits rules/schedules in dashboard → server persists.
2. Server computes **effective policy** per device (merge child rules + schedule state + quotas).
3. Policy pushed to agent over WS (and fetchable via REST on reconnect).
4. Agent evaluates policy locally every tick so enforcement continues offline.
5. Agent reports activity + captures → server → content analysis → alerts → notifications.

## WS protocol
JSON messages `{ t: <type>, ... }`. Device auth handshake with device token, then:
server→agent `policy`, `command` (lock/unlock/refresh); agent→server `hello`, `heartbeat`,
`activity`, `ack`. Constants live in `@hearth/shared`.

## Security
Parent JWT (short-lived) + device tokens (opaque, revocable). HTTPS expected in production
(reverse proxy). Captures encrypted at rest (M7). CORS locked to dashboard origin.
