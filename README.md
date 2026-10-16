# Supplier Rescue

Supplier Rescue traces a manufacturing disruption through component dependencies and customer orders, evaluates replacement supply, and records an approved recovery plan with source evidence.

The included Northline Lighting dataset is fictional and explicitly synthetic. Internal allocations and draft requisitions are real application records; the application does not purchase components, reserve external supplier stock or guarantee customer delivery.

## Development

Requirements: Node.js 22.12 or later, pnpm 10 and Docker Compose.

```sh
pnpm install --frozen-lockfile
cp .env.example .env
# Set COOKIE_SECRET to a random value of at least 32 characters.
docker compose up -d
pnpm test
```

The database listens on localhost port 6388. Its image is pinned by digest and AOF data is stored in a named volume. Do not expose the database port publicly.

## Recovery model

FalkorDB is the domain store. Parameterized Cypher traverses factory -> supply offer -> part -> subassembly -> product -> customer order paths, checks replacement approvals and persists plans, approvals, allocations, requisitions and activity.

The bounded deterministic planner supports up to three orders and four offers, integer quantities, explicit compatibility/approval records, fixed assembly/delivery assumptions, quantity and budget limits. It ranks feasible plans by complete on-time orders, earlier deadlines, total coverage, then additional cost. It reports when its search limit is reached. It is not a general-purpose production optimizer.

Approval is bound to an application revision. A single guarded graph write records the allocation and draft requisition; a subsequent query verifies saved state. Repeated commits return the saved result, and a source update invalidates an unexecuted proposal.

## Verification

`pnpm test` runs planner invariants and integration tests against a real FalkorDB instance. Cases include shared upstream exposure, incompatible parts, independent finished stock, budget constraints, missing evidence, changed source revisions, duplicate commits, workspace isolation and reduced-quantity supply.

Core scenario: 100 drivers required, 20 on hand, 80 additional units at $12 instead of $10. Draft value is $960 and incremental cost is $160. The reduced-stock case leaves a 30-unit shortage rather than inventing supply.

## AI assistance

AI coding assistance is used in this project. The source, queries, constraint checks and verification results are provided for inspection. The submitted implementation remains the participant's responsibility.

## License

MIT. Copyright (c) 2026 Allen Saji.
