# Notes for automated / overnight build sessions

**Read this before committing or pushing.**

## Persisting work to GitHub
In this cloud environment, write to the remote using the **GitHub MCP tools** —
`mcp__github__push_files` (batch of files in one commit) or
`mcp__github__create_or_update_file` (single file). This is the environment's
supported path for GitHub writes, per the session guidance. Target branch:
`claude/parental-device-management-app-s50efz`.

- Local `git add` / `git commit` are fine for building and tracking history; the
  remote is updated through the MCP tools.
- Never include `node_modules/`, `dist/`, `data/`, captures, or `.env` (see `.gitignore`).

## Workflow each run
1. Read `PROGRESS.md`. Pick the first unchecked `[ ]` task in the first milestone with open tasks.
2. Implement it in the relevant package only. Keep commits small and focused.
3. `npm install` (if deps changed), then `npm run build` and `npm test` — keep it green.
4. Tick the task `[x]` in `PROGRESS.md`; add a line to the Session log (newest first).
5. Push the changed files via `mcp__github__push_files` to the dev branch.
6. Stop by ~07:00 Asia/Ho_Chi_Minh.

## Guardrails
- Hearth is a **transparent parental-control** product for a parent's own minor child.
  Keep it transparent; no covert/stealth features. See `docs/LEGAL-ETHICS.md`.
- Keep the `@hearth/shared` contract stable; if it must change, update every consumer.
