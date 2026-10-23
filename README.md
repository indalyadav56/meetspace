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

Open http://localhost. A Caddy gateway (`deploy/caddy/Caddyfile`) is the single entry point on port 80:

| Path         | Goes to                                                     |
|--------------|-------------------------------------------------------------|
| `/`          | the web app                                                 |
| `/api/*`     | the backend (REST, realtime WebSocket, assistant streaming) |
| `/livekit/*` | LiveKit signalling (media itself uses UDP 50000-50100)      |
| `/storage/`  | MinIO console                                               |

After loading data that existed before search was enabled, build the search index once:

```bash
docker compose run --rm backend ./reindex
```

| Service  | Port                        | What it does                                         |
|----------|-----------------------------|------------------------------------------------------|
| gateway  | 80                          | Caddy: one entry point for app, API, LiveKit, MinIO  |
| web      | –                           | Built React app (nginx, behind the gateway)          |
| backend  | 8080                        | REST API, WebSocket realtime, LiveKit webhooks       |
| worker   | –                           | Fires reminders; keeps the search index up to date   |
| opensearch | 9200                      | Full-text search (Apache-2.0 fork of Elasticsearch)  |
| livekit  | 7880, 7881, 50000-50100/udp | Self-hosted media server for calls (open source)     |
| minio    | 9000 (S3 API), 9001 (console) | Object storage for clip and call recordings        |
| postgres | 5432                        | One schema per bounded context                       |
| redis    | 6379                        | Realtime fan-out between API instances               |

## Develop locally

```bash
docker compose up -d postgres redis livekit minio opensearch
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

## Search (OpenSearch)

⌘K opens workspace search: tasks (also by key, e.g. `MS-12`), docs, chat messages, comments, clips and their transcripts, goals, whiteboards, forms, Lists, projects and meetings. Results are typo-tolerant, match as you type and highlight the matching text, and you can narrow them by type or sort by most recent. Direct messages are only found by their members.

The worker listens to the same change events the realtime WebSocket uses and indexes every change within a second or two. `./reindex` (or `go run ./cmd/reindex`) rebuilds the index from the database. With no `APP_OPENSEARCH_URLS`, search falls back to title matching in the browser.

## Object storage (MinIO)

Clip and call recordings are stored in MinIO (bucket `meetspace-media`, created on startup) and streamed through the API, which checks workspace access and supports range requests for seeking. MinIO no longer publishes free Docker images, so `deploy/minio/Dockerfile` builds the official open-source release at a pinned tag. The console is at http://localhost/storage/ through the gateway (dev credentials are in `docker-compose.yaml`). Any S3-compatible store works through the `APP_MINIO_*` settings; set `APP_MEDIA_STORAGE=filesystem` to keep files on local disk instead.

## Email (Resend)

Password resets and workspace invites are sent through the [Resend](https://resend.com) API:

1. Create an API key with **Sending access** at resend.com/api-keys.
2. Add `APP_RESEND_API_KEY=…` to `apps/backend/.env` (git-ignored). Both `go run` and Docker Compose read this file.
3. Restart: `docker compose up -d backend worker`.

The sender defaults to `Meetspace <onboarding@resend.dev>`, which Resend only delivers to your own account's address. To email anyone, verify a domain under resend.com/domains and set `APP_RESEND_FROM=Meetspace <noreply@yourdomain.com>`. Any other provider works over SMTP via the `APP_SMTP_*` settings. With neither configured, emails (including their links) are written to the backend log.

## Configuration

Backend settings live in `apps/backend/configs/<APP_ENV>.yaml` and can be overridden with `APP_`-prefixed environment variables (see `apps/backend/env.example`). Production requires at least:

- `APP_JWT_SECRET`
- the Postgres and Redis settings
- the LiveKit keys
