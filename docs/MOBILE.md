# Mobile Strategy (iPad / iPhone / Android)

Mobile OSes restrict background monitoring far more than desktop. Hearth uses **platform-sanctioned**
mechanisms only.

## iOS / iPadOS
No App Store app may silently screenshot or key-log another person's device. Supported approaches:
1. **Screen Time + Family Sharing** — parent configures Downtime, App Limits, Content & Privacy
   restrictions and Communication limits from their own Apple ID. Hearth provides a guided
   checklist and recommended settings export.
2. **MDM configuration profile (`.mobileconfig`)** — Hearth generates a signed/unsigned profile that:
   - sets a **Web Content Filter** (allowed/denied domains, auto-filter adult),
   - restricts app installation / explicit content,
   - **prevents profile removal** (so the child cannot disable it),
   - optionally supervises the device (via Apple Configurator) for stronger controls.
   Delivered as an installable file + step-by-step guide. Remote screenshots of iOS are **not possible**;
   documented as a hard limit.

## Android
A dedicated app using sanctioned APIs:
- **VpnService** local VPN → on-device DNS filtering for website/app-domain blocking (no traffic leaves device).
- **DeviceAdmin / DevicePolicyManager** → lock device, enforce schedules, resist uninstall.
- **AccessibilityService** → foreground app detection, in-app content heuristics (with notice).
- **UsageStatsManager** → screen-time reporting and per-app budgets.
- **MediaProjection** → screenshots **only with an explicit, visible capture consent** per Android policy.
Staged: architecture doc first, then an MVP (enroll + DNS web filter + usage reporting).

## Reporting the truth to users
We never promise covert iOS screenshotting or uninstall-proof hidden apps where the OS forbids it.
Capabilities are listed per platform with their real limits.
