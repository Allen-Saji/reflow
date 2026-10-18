# Operations and deployment

See the [README](../README.md#quick-start) for local setup. Reflow runs one TypeScript/Fastify process and one FalkorDB service. Vite builds the frontend into `dist/`, which the application serves alongside the API.

## Configuration

| Variable                | Local default                                  | Purpose                                                         |
| ----------------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| `PORT`                  | `3410`                                         | HTTP server port                                                |
| `HOST`                  | `127.0.0.1`                                    | HTTP bind address; use `0.0.0.0` in a container                 |
| `FALKORDB_HOST`         | `127.0.0.1`                                    | Database hostname; use a private service hostname in production |
| `FALKORDB_PORT`         | `6388`                                         | Database port; the Compose container itself listens on 6379     |
| `FALKORDB_PASSWORD`     | Unset                                          | Optional database password                                      |
| `COOKIE_SECRET`         | Random per-process fallback outside production | Stable signing secret; configure at least 32 random characters  |
| `COOKIE_SECURE`         | `false`                                        | Set `true` for HTTPS deployments                                |
| `OPENROUTER_API_KEY`    | Unset                                          | Enables model-selected investigation                            |
| `OPENROUTER_MODEL`      | `openai/gpt-4.1-mini`                          | Tool-calling model identifier                                   |
| `DAILY_AGENT_RUN_LIMIT` | `40`                                           | Total autonomous runs per process per UTC day                   |

`NODE_ENV=production` requires a configured `COOKIE_SECRET`. Losing or changing the signing secret invalidates existing workspace cookies. Keep secrets outside Git, image build arguments and logs. `.env.example` is the supported local template.

Model-selected runs send requests and supplied records to OpenRouter and the selected model provider. Guided mode uses the same MCP tools without inference and does not require an API key.

## Container deployment

The [Dockerfile](../Dockerfile) builds the frontend, including `public/` assets, and runs the API as a non-root user. Supply runtime environment variables through the hosting platform. The hosted preview uses one app instance and one private graph service.

Keep FalkorDB on a private network. For the graph image used in [compose.yaml](../compose.yaml), configure:

```text
BROWSER=0
FALKORDB_DATA_PATH=/data
REDIS_ARGS=--appendonly yes --appendfsync always --maxmemory-policy noeviction
```

Mount persistent storage at `/data`. `FALKORDB_DATA_PATH` is required because the image entrypoint controls the data directory. The local Compose file pins the database image by digest, binds its port to localhost and uses a named volume. Persistent storage is not a backup strategy; no automated backup or retention jobs are included.

The initial HTML contains absolute OG/Twitter image URLs for the current hosted domain. Update those URLs in `index.html` when deploying under a different canonical domain.

## Health and access

`GET /api/health` checks database connectivity and returns HTTP 503 if the database is unavailable. It does not check model-provider availability.

Workspace membership is stored in an HTTP-only signed cookie with SameSite Strict. The cookie lasts three days and retains up to eight workspace IDs. There are no accounts, recovery flow or team-sharing permissions. Graph records are not automatically removed when browser access expires.

## Preview limits

- Three simultaneous investigations per application process, with one investigation at a time per workspace.
- Three autonomous runs per workspace per UTC day and `DAILY_AGENT_RUN_LIMIT` total autonomous runs per process per UTC day.
- HTTP rate limit: 120 requests per minute; workspace creation: 20 requests per hour.
- Quota counters are in process memory and reset on restart. Guided mode bypasses autonomous-run quotas but still uses concurrency and HTTP controls.
- At most three customer orders, four supplier offers and 250 ordered units per structured scenario. One committed recovery per scenario; create a fresh workspace to compare changes afterward.

Multi-instance use needs shared quotas and an account/access model. This preview does not implement external procurement, confidential-data handling, automatic retention or managed backups.

## Local MCP stdio server

The same MCP implementation used by the app can run as a local stdio server:

```sh
MCP_WORKSPACE=sr_your_existing_workspace_id node --import tsx src/server/mcp-stdio.ts
```

Load database environment variables in that process as appropriate for the MCP client. An authorized browser's `/api/state` response includes its workspace ID. Stdio operators inherit their database access; browser-cookie membership is not a separate access boundary for a local database administrator. Do not expose this transport publicly.

Investigation tools trace disruption, find offers, retrieve evidence and evaluate proposals. Execution additionally requires a server-recorded approval. See [src/server/mcp.ts](../src/server/mcp.ts) and [Architecture](architecture.md).
