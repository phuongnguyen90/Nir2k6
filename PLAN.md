# Hearth — Parental Device Management · Master Plan

> Self-hostable suite to help a parent manage a child's devices (PC/Mac, iPad, phone):
> filter web/apps, enforce time-based locks, capture screen activity, and raise alerts
> on inappropriate content. Inspired by Kidsafe, Qustodio, Bark, Microsoft Family Safety,
> Apple Screen Time. **Design goal: transparent, parent-controlled, self-hosted — not covert
> stalkerware.** See `docs/LEGAL-ETHICS.md`.

## 1. Product scope

| Capability (vi) | Capability (en) | Where it runs | Feasibility |
|---|---|---|---|
| Chặn/mở website | Block / allow websites | Desktop agent (hosts/DNS/proxy); router DNS | High (desktop), Med (mobile via DNS) |
| Chặn/mở app | Block / allow applications | Desktop agent (process watch) | High (desktop), Low (iOS), Med (Android) |
| Khoá máy theo giờ | Time-based device lock / schedules | Desktop agent (lock screen); server schedule engine | High (desktop) |
| Chụp/log màn hình | Screenshot & activity logging | Desktop agent (periodic capture) | High (desktop) |
| Cảnh báo nội dung xấu | Alert on nsfw / "đồi truỵ" content | Server content-analysis pipeline | Med (URL+keyword High, image NSFW Med) |
| Báo cáo / thông báo | Reports & notifications to parent | Server + dashboard + push/email/telegram | High |

### Platform reality (be honest with the user)
- **Windows / macOS / Linux desktop:** a background agent can do nearly everything. This is the primary target and where we deliver a working product first.
- **Android:** possible with Device Admin + Accessibility + VpnService (local DNS filtering) + UsageStats. Requires a dedicated native app; staged as a later milestone with a documented design.
- **iPhone / iPad:** Apple forbids silent monitoring apps. Legit paths are (a) **Screen Time + Family Sharing** (parent configures on their own Apple ID), and (b) an **MDM configuration profile** that enforces web-content filtering, app limits and blocks profile removal. We ship installable `.mobileconfig` profiles + a setup guide, not a covert app. Screenshotting another iOS device remotely is not permitted by iOS; we document this limit clearly.

## 2. Architecture

```
                 ┌────────────────────────┐
   Parent  ◀──▶  │  Dashboard (React SPA)  │
                 └───────────┬─────────┘
                             │ REST + WS (JWT)
                 ┌───────────▼─────────┐
                 │  Server (Fastify+SQLite)│
                 │  - rules & schedules    │
                 │  - device registry/auth │
                 │  - ingest logs/captures │
                 │  - content analysis     │
                 │  - notifications        │
                 └───────────┬─────────┘
          device token (WS)  │
      ┌──────────────┬───────┴────────┬──────────────┐
      ▼              ▼                ▼              ▼
 Desktop agent   Desktop agent   Android app     iOS profile
 (Win/mac/linux) (child #2)      (later)        (.mobileconfig)
```

- **Transport:** agents hold a long-lived WebSocket to the server and poll a REST fallback. All device→server traffic authenticated with a per-device token; parent→server with JWT.
- **Data store:** SQLite (better-sqlite3) for easy self-hosting; schema in `packages/server/src/db`.
- **Monorepo:** npm workspaces. Shared contract (`@hearth/shared`) defines all DTOs + zod schemas so server, dashboard and agent never drift.

## 3. Packages

- `packages/shared` — TypeScript types, zod schemas, API route constants, WS message protocol. **Single source of truth.**
- `packages/server` — Fastify API, SQLite, WS hub, schedule engine, content-analysis pipeline, notifier.
- `packages/dashboard` — React + Vite + Tailwind parent UI.
- `packages/agent-desktop` — cross-platform Node agent (platform adapters for win/mac/linux).

## 4. Content analysis ("cảnh báo xem nhảm / đồi truỵ")

Layered, cheapest-first, pluggable analyzers in `packages/server/src/analysis`:
1. **URL/domain categorization** — match visited domains against bundled blocklists (adult, gambling, violence) + user lists. Fast, no ML.
2. **Keyword / title heuristics** — scan window titles, URLs, search queries for weighted term lists (multi-language incl. Vietnamese). Produces a risk score.
3. **Image NSFW classifier (optional)** — run periodic screenshots through a local model (NSFWJS/TensorFlow.js) or an opt-in external API. Off by default; configurable.
4. **Scoring + policy** — combine signals → severity (info/warn/alert) → notification + log entry.

## 5. Scheduling & enforcement engine

- Parent defines per-child **time windows** (e.g. bedtime lock 21:00–07:00, screen-time quotas, per-app limits).
- Server computes the *effective policy* for each device at any moment and pushes it over WS; agent also evaluates locally so enforcement survives network loss.
- Enforcement actions: lock screen, kill/block app, block domain, force logout, show a friendly "time's up" message.

## 6. Security & privacy

- Captures and logs are sensitive. Encrypt at rest (per-install key), access only via authenticated dashboard, configurable retention (auto-purge), and a visible indicator / consent screen on the child device. See `docs/LEGAL-ETHICS.md`.

## 7. Milestones (see PROGRESS.md for live status)

- **M0 Foundation** — monorepo, shared contract, CI, docs. ← bootstrapped in first session
- **M1 Server MVP** — auth, device registry, rules/schedules CRUD, WS hub, ingest endpoints, SQLite.
- **M2 Dashboard MVP** — login, children/devices, rule editor, schedule editor, activity & screenshot viewer, alerts feed.
- **M3 Desktop agent MVP** — enroll, WS connect, heartbeat, time-lock enforcement, website blocking (hosts), screenshot capture, foreground-window logging.
- **M4 Content analysis** — URL+keyword analyzers, scoring, alert generation, notifications (email/telegram).
- **M5 App blocking + quotas** — process watch, per-app limits, screen-time budgets.
- **M6 Mobile** — Android app design + MVP; iOS `.mobileconfig` profiles + guide.
- **M7 Hardening** — encryption at rest, retention/purge, packaging/installers, e2e tests.

## 8. Parallelization strategy

Work is split so independent modules build concurrently (parallel agents / overnight sessions):
- Track A: server (M1 → M4/M5 backend)
- Track B: dashboard (M2)
- Track C: desktop agent (M3 → M5 enforcement)
- Track D: content analysis + mobile design/docs (M4/M6)
The `@hearth/shared` contract is frozen first so tracks don't collide. Each track owns its own package directory to avoid merge conflicts.

## 9. Overnight autonomous build

A scheduled task runs nightly ~00:30–07:00 Asia/Ho_Chi_Minh. Each run: pull branch, read PROGRESS.md, pick the next `[ ]` task from the top open milestone, implement + typecheck/test, commit, push, tick the task in PROGRESS.md. Keeps PRs/commits small and green.
