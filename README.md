# Meetspace

One workspace for tasks, docs, chat, goals, clips and video/audio calls.

```
apps/
  backend/   Go API, worker, migrator and seeder (DDD bounded contexts)
  web/       React + Vite app
deploy/
  livekit.yaml   self-hosted LiveKit SFU config
```

## Run everything with Docker

```bash
docker compose up --build
```

Then load demo data (the demo sign-in is documented at the top of `apps/backend/cmd/seed/main.go`):

```bash
docker compose run --rm backend ./seed
```

Open http://localhost:3000. Nginx serves the app and proxies `/api` (REST, the realtime WebSocket and assistant streaming) to the backend.

| Service  | Port                        | What it does                                         |
|----------|-----------------------------|------------------------------------------------------|
| web      | 3000                        | Built React app behind nginx                         |
| backend  | 8080                        | REST API, WebSocket realtime, LiveKit webhooks       |
| worker   | –                           | Fires due reminders into the Inbox                   |
| livekit  | 7880, 7881, 50000-50100/udp | Self-hosted media server for calls (open source)     |
| postgres | 5432                        | One schema per bounded context                       |
| redis    | 6379                        | Realtime fan-out between API instances               |

## Develop locally

```bash
docker compose up -d postgres redis livekit
cd apps/backend && make migrate && make seed && make run   # API on :8080
cd apps/backend && make worker                             # reminders
cd apps/web && npm install && npm run dev                  # app on :5173, proxies /api to :8080
```

## AI assistant

The assistant is an agent built with Google's Agent Development Kit for Go (`google.golang.org/adk`) running Gemini. Its tools search, create and update tasks, comment, and read and write docs, through the same services as the REST API. Set `APP_AI_GEMINI_API_KEY` (or `GEMINI_API_KEY` for Docker Compose) to turn it on. Without a key the app falls back to a built-in offline mode that handles common requests. Conversations are stored by ADK's database session service in the `assistant` schema.

## Calls

Calls use a self-hosted LiveKit server (not LiveKit Cloud):

1. The API creates the call and returns a room token.
2. Invitees are rung over the realtime socket.
3. LiveKit webhooks (signed with the API secret) keep the call log's live participants up to date.

For production, set real `livekit.api_key`/`api_secret` in both `deploy/livekit.yaml` and the backend config, and enable `rtc.use_external_ip`.

## Configuration

Backend settings live in `apps/backend/configs/<APP_ENV>.yaml` and can be overridden with `APP_`-prefixed environment variables (see `apps/backend/env.example`). Production requires at least:

- `APP_JWT_SECRET`
- the Postgres and Redis settings
- the LiveKit keys
