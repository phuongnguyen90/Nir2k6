# Hearth — Parental Device Management

Self-hostable suite to help a parent manage a child's devices — **computer, tablet, phone** —
with web/app filtering, time-based locks, screen-activity capture, and content alerts.
Inspired by Kidsafe, Qustodio, Bark, Microsoft Family Safety and Apple Screen Time.

> **Transparent by design, not stalkerware.** Built for a parent/guardian to manage their own
> minor child's devices, with on-device notice. Please read **[docs/LEGAL-ETHICS.md](docs/LEGAL-ETHICS.md)**.

## What it does
- 🌐 **Block / allow websites & apps** (allow-lists, block-lists, category filters)
- ⏰ **Lock devices on a schedule** (bedtime lock, screen-time quotas, per-app limits)
- 🖥️ **Capture screen activity** (periodic screenshots + foreground-app log, configurable)
- 🚨 **Alert on harmful content** ("xem nhảm / đồi truỵ") via URL + keyword + optional image analysis
- 📊 **Parent dashboard** with reports, activity timeline, and an alerts feed

## Platform support (honest)
| Platform | Status | How |
|---|---|---|
| Windows / macOS / Linux | **Primary** | background agent (full feature set) |
| Android | Planned | sanctioned APIs (VpnService DNS filter, DeviceAdmin, UsageStats) |
| iPhone / iPad | Planned | Screen Time / Family Sharing + MDM `.mobileconfig` (no covert monitoring — Apple forbids it) |

See **[docs/MOBILE.md](docs/MOBILE.md)** for the real limits on each OS.

## Repo layout
```
packages/shared         typed contract (DTOs, zod, routes, WS protocol)
packages/server         Fastify + SQLite API, WS hub, content analysis, notifier
packages/dashboard      React + Vite parent UI
packages/agent-desktop  cross-platform Node agent (win/mac/linux adapters)
docs/                   architecture, legal/ethics, mobile, deployment
PLAN.md / PROGRESS.md   roadmap + live task board
```

## Quickstart
See **[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)**. TL;DR: `npm install && npm run build`, start the
server, open the dashboard, enroll a child's computer with the agent.

## Status
Early, actively built (incl. autonomous overnight sessions). Track progress in **[PROGRESS.md](PROGRESS.md)**.
