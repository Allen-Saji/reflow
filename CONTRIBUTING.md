# Contributing to Reflow

Thanks for helping improve Reflow. Start with the [README](README.md) and [architecture](docs/architecture.md), then open a focused issue or pull request.

## Local development

Follow the [quick start](README.md#quick-start). The database runs through `docker compose up -d` and listens on localhost port 6388. Keep `.env` local; `.env.example` lists supported configuration.

For live frontend changes, use two terminals:

```sh
pnpm dev
```

```sh
pnpm dev:web
```

Open http://127.0.0.1:3411. The Vite server proxies API requests to port 3410.

## Reporting a bug

Include the expected result, actual result, reproduction steps, relevant environment and a small public/synthetic input if needed. State whether the investigation used model-selected or guided mode. For allocation issues, include the source quantities, deadlines and cost limit so the result can be reproduced.

Do not include `.env` values, API keys, signed cookies, confidential supplier records or customer data. If an issue involves sensitive security details, request a private contact channel without posting those details publicly.

## Pull requests

- Keep changes focused and explain the user-visible behavior.
- Use TypeScript and follow the surrounding formatting. Use Conventional Commit subjects such as `fix: reject expired supplier quotes`.
- Document new configuration in `.env.example` and the operations guide.
- Use synthetic data for examples, screenshots and fixtures.
- Add meaningful regression coverage when behavior changes, especially for constraints, graph traversal, authorization or approved writes.
- Describe the checks you ran and any checks you could not run. Do not claim hosted or model-provider verification from guided/local tests.

## Verification

With FalkorDB running:

```sh
pnpm build
pnpm test
pnpm exec playwright install chromium --only-shell
pnpm test:e2e
```

Browser tests start their own application server on port 3411; stop the Vite server first. Provider inference is not required for these deterministic checks. To exercise model-selected investigation separately, configure an OpenRouter key and run it with public/synthetic records.

## Domain boundaries

Preserve these behaviors when changing the planner or agent:

- Query graph exposure and component approvals before treating an offer as eligible.
- Keep price arithmetic in integer cents and quantities in whole units.
- Separate on-hand stock, expected supply, draft requisitions and delivered goods.
- Count only complete orders meeting their modeled deadlines as projected on time.
- Require an explicit server-recorded approval tied to the proposal's exact revision.
- Independently validate proposals and read back committed graph records.
- Keep workspace membership checks and repeated-commit protection intact.
- Treat model output and source text as untrusted input, never execution approval.

By contributing, you agree that your contributions are provided under the repository's [MIT license](LICENSE).
