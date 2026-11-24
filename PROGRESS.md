# Hearth — Build Progress Board

> Live task board. Overnight sessions: pick the **first unchecked `[ ]` task in the first
> milestone that still has open tasks**, implement it, typecheck/test, commit (small),
> push, then check it `[x]` here in the same commit. Keep the build green.
> Append a note under "Session log" each run.

Legend: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (explain in notes)

## M0 — Foundation
- [x] Monorepo scaffold (npm workspaces, tsconfig base, .gitignore)
- [x] PLAN.md + PROGRESS.md
- [x] Docs: ARCHITECTURE, LEGAL-ETHICS, MOBILE, DEPLOYMENT
- [x] `@hearth/shared` contract: types, zod schemas, route + WS message constants
- [x] CI workflow (typecheck + build on push)
- [x] Root README with honest scope + quickstart

## M1 — Server MVP (@hearth/server)
- [x] Fastify app bootstrap + config loader (.env) + health route
- [x] SQLite layer (better-sqlite3) + migrations runner
- [x] Schema: parents, children, devices, rules, schedules, activity, captures, alerts, tokens
- [x] Auth: parent signup/login (scrypt + JWT), device enroll + per-device token
- [x] Children & devices CRUD endpoints
- [x] Rules CRUD (block/allow lists for domains + apps)
- [x] Schedules CRUD (time windows, quotas) + effective-policy computation
- [x] Ingest endpoints: activity log, screenshot upload, heartbeat
- [x] WebSocket hub: device auth, policy push, command channel (lock/unlock)
- [x] Alerts list/ack endpoints
- [ ] Unit tests for policy engine + auth (basic done; expand)

## M2 — Dashboard MVP (@hearth/dashboard)
- [x] Vite + React + TS setup, API client from @hearth/shared
- [x] Auth screens (login/signup) + token storage + route guard
- [x] Children & devices overview (status, last seen)
- [x] Rule editor (domain/app allow-block lists)
- [x] Schedule editor (weekly windows, bedtime lock, quotas)
- [x] Activity timeline + screenshot gallery viewer
- [x] Alerts feed with severity + acknowledge
- [x] Device enroll flow (show enroll code / token)
- [ ] Live device status via WS

## M3 — Desktop agent MVP (@hearth/agent-desktop)
- [x] Agent bootstrap, config, token storage, enroll flow
- [x] WS client: connect, heartbeat, receive policy + commands, reconnect/backoff
- [x] Platform adapter interface (win/mac/linux)
- [x] Time-lock enforcement (lock screen) — linux adapter + win/mac stubs
- [x] Website blocking via hosts file (platform-aware, revertible)
- [x] Screenshot capture (periodic, respects config) + upload
- [x] Foreground window / active app logging + upload
- [x] Local policy evaluation (works offline)
- [ ] App/process blocking (kill or prevent launch)

## M4 — Content analysis (@hearth/server/analysis)
- [x] Analyzer interface + scoring/severity model
- [x] URL/domain categorizer + bundled blocklist loader
- [x] Keyword/title heuristic analyzer (multi-lang incl. Vietnamese term lists)
- [x] Alert generation from analysis results
- [ ] Notifications: email (SMTP) + Telegram bot
- [ ] Optional image NSFW classifier (local model, opt-in) — design + stub
- [x] Tests for analyzers + scoring

## M5 — App blocking + quotas
- [ ] Per-app time budgets (server policy + agent enforce)
- [ ] Daily screen-time quota + friendly lock message
- [ ] Process-watch enforcement across platforms

## M6 — Mobile
- [ ] iOS `.mobileconfig` generator (web filter, app limits, prevent-removal) + guide
- [ ] Android app architecture doc (VpnService DNS filter, DeviceAdmin, Accessibility, UsageStats)
- [ ] Android MVP: enroll + DNS-based web filtering + usage reporting

## M7 — Hardening
- [ ] Encrypt captures/logs at rest (per-install key) + key management
- [ ] Retention + auto-purge policy (configurable)
- [ ] Packaging: server Docker image; agent installers (win/mac/linux)
- [ ] End-to-end test: enroll -> policy push -> enforce -> capture -> alert
- [ ] Rate limiting + audit log on dashboard actions

---
## Session log
<!-- newest first; overnight sessions append here -->
