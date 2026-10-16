# Reflow

Reflow traces a manufacturing disruption through component dependencies and customer orders, evaluates replacement supply, and records an approved recovery plan with source evidence.

The included Northline Lighting dataset is fictional and explicitly synthetic. Internal allocations and draft requisitions are real application records; the application does not purchase components, reserve external supplier stock or guarantee customer delivery.

[Open Reflow](https://app-production-e384.up.railway.app)

## Development

Requirements: Node.js 22.12 or later, pnpm 10 and Docker Compose.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set COOKIE_SECRET to a random value of at least 32 characters.
docker compose up -d
pnpm build
pnpm start
```

Open http://127.0.0.1:3410. Use the sample workspace, report a factory disruption, run an investigation, then review and approve the internal changes. Data & evidence provides the reduced-quantity scenario and JSON import/export. Workspace access belongs to the browser cookie; this preview has no account recovery or team sharing.

For frontend development, run `pnpm dev` and `pnpm dev:web` in separate terminals, then open the Vite URL. Rebuild with `pnpm build` to update the single-server preview.

The database listens on localhost port 6388. Its image is pinned by digest and AOF data is stored in a named volume. Do not expose the database port publicly.

[Architecture, graph model and essential Cypher](docs/architecture.md) | [Interface design system](docs/design-system.md)

## Recovery model

FalkorDB is the domain store. Parameterized Cypher traverses factory -> supply offer -> part -> subassembly -> product -> customer order paths, checks replacement approvals and persists plans, approvals, allocations, requisitions and activity.

The bounded deterministic planner supports up to three orders and four offers, integer quantities, explicit compatibility/approval records, fixed assembly/delivery assumptions, quantity and budget limits. It ranks feasible plans by complete on-time orders, earlier deadlines, total coverage, then additional cost. It reports when its search limit is reached. It is not a general-purpose production optimizer.

Approval is bound to an application revision. A single guarded graph write records the allocation and draft requisition; a subsequent query verifies saved state. Repeated commits return the saved result, and a source update invalidates an unexecuted proposal. Recorded scenarios lock source edits; use a fresh scenario for subsequent comparisons.

## Investigation modes

Set `OPENROUTER_API_KEY` and optionally `OPENROUTER_MODEL` (default `openai/gpt-4.1-mini`) in `.env` to enable model-selected MCP tool calls. Records and investigation requests are sent to OpenRouter and the selected model provider. Import only public or synthetic data you can share. Source text is untrusted input; the model cannot approve or purchase anything.

Guided mode runs the same MCP tools in a fixed sequence without model inference. Its UI is explicitly labeled. The app uses the official MCP SDK client/server protocol over linked in-memory transports. A separate stdio server is available for local MCP clients:

```sh
MCP_WORKSPACE=sr_your_existing_workspace_id node --import tsx src/server/mcp-stdio.ts
```

An administrator with database access can obtain the workspace ID from `/api/state` in an authorized browser. The stdio process is local and inherits that operator's database access. Do not expose it publicly. Investigation tools are `trace_disruption`, `find_replacement_offers`, `get_evidence` and `evaluate_recovery_options`; execution tools additionally require a server-recorded approval.

## Deployment

The Dockerfile builds the frontend and runs the API as a non-root user. Set `COOKIE_SECRET` to at least 32 random characters, `COOKIE_SECURE=true`, `HOST=0.0.0.0`, `PORT`, and `FALKORDB_HOST`/`FALKORDB_PORT`. Keep FalkorDB on a private network. The graph image requires `FALKORDB_DATA_PATH=/data` and a persistent volume mounted at `/data`; `REDIS_ARGS=--appendonly yes --appendfsync always --maxmemory-policy noeviction` enables durable writes. Disable its unused browser with `BROWSER=0`.

`GET /api/health` checks database connectivity. The hosted preview uses one application instance and one graph instance with a persistent volume. The application keeps concurrency and inference quotas in process memory: three simultaneous investigations, three autonomous runs per workspace per UTC day, and `DAILY_AGENT_RUN_LIMIT` (default 40) total autonomous runs per UTC day. Restarts reset these counters. Guided mode stays available. HTTP and workspace-creation rate limits also apply. Production scaling needs a shared quota store and managed user accounts.

Cookie access lasts three days. Graph records currently remain until an operator removes them; no automatic data expiry or backups are configured. This preview is scoped to small structured scenarios, not confidential procurement data or operational purchasing.

## Verification

Run `pnpm test` with the local database running. Run `pnpm exec playwright install chromium --only-shell`, then `pnpm test:e2e` for the browser workflow, reload persistence and stale-proposal checks. `pnpm build` includes strict TypeScript checking.

`pnpm test` runs planner invariants and integration tests against a real FalkorDB instance. Cases include shared upstream exposure, incompatible parts, independent finished stock, budget constraints, missing evidence, changed source revisions, duplicate commits, workspace isolation and reduced-quantity supply.

Core scenario: 100 drivers required, 20 on hand, 80 additional units at $12 instead of $10. Draft value is $960 and incremental cost is $160. The reduced-stock case leaves a 30-unit shortage rather than inventing supply.

## AI assistance

AI coding assistance is used in this project. The source, queries, constraint checks and verification results are provided for inspection. The submitted implementation remains the participant's responsibility.

## License

MIT. Copyright (c) 2026 Allen Saji.
