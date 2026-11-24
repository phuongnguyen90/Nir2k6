# Deployment / Self-hosting

## Dev quickstart
```bash
npm install
npm run build
# server
cp packages/server/.env.example packages/server/.env   # edit secrets
npm run dev:server        # http://localhost:8080
# dashboard
npm run dev:dashboard     # http://localhost:5173 (proxies /api -> 8080)
# agent (on the child's computer)
npm run dev:agent -- --server http://<host>:8080 --enroll <code>
```

## Production
- Run the server behind HTTPS (Caddy/Nginx/Traefik). Set `JWT_SECRET`, `ENCRYPTION_KEY`, DB path.
- Build the dashboard (`npm run build -w @hearth/dashboard`) and serve `dist/` statically (or let the server host it).
- Package the agent per OS (M7 installers). Agent needs privileges for hosts-file edits / screen lock.
- Back up the SQLite file and the encryption key together; without the key, captures are unrecoverable.

## Config (server `.env`)
See `packages/server/.env.example` — port, DB path, JWT secret, encryption key, SMTP/Telegram for alerts,
screenshot retention days.
