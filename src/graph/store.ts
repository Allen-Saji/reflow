import { FalkorDB } from "falkordb";
import { randomUUID } from "node:crypto";
import { sampleFixture } from "../domain/fixture.js";
import {
  validateFixture,
  type Fixture,
  type Snapshot,
  type Impact,
  type Candidate,
  type EvidencePath,
  type Plan,
  type Disruption,
} from "../domain/model.js";
import {
  evaluateCandidates,
  planRecovery,
  validatePlan,
} from "../domain/planner.js";
let connection: ReturnType<typeof FalkorDB.connect> | undefined;
export async function db() {
  return (connection ??= FalkorDB.connect({
    socket: {
      host: process.env.FALKORDB_HOST || "127.0.0.1",
      port: Number(process.env.FALKORDB_PORT || 6388),
    },
    ...(process.env.FALKORDB_PASSWORD
      ? { password: process.env.FALKORDB_PASSWORD }
      : {}),
  }));
}
export async function closeDb() {
  if (connection) {
    (await connection).close();
    connection = undefined;
  }
}
export function validWorkspace(id: string) {
  return /^sr_[a-f0-9]{32}$/.test(id);
}
async function query(
  workspace: string,
  cypher: string,
  params: Record<string, any> = {},
) {
  if (!validWorkspace(workspace)) throw new Error("Invalid workspace.");
  const graph = (await db()).selectGraph(workspace);
  return (await graph.query(cypher, { params })).data as Record<string, any>[];
}
export async function createWorkspace(input: Fixture = sampleFixture()) {
  const f = validateFixture(input),
    workspace = "sr_" + randomUUID().replaceAll("-", "");
  const params: Record<string, any> = {
    settings: JSON.stringify({
      name: f.name,
      datasetKind: f.datasetKind,
      currentDay: f.currentDay,
      baselineCostCents: f.baselineCostCents,
      premiumCapCents: f.premiumCapCents,
      assemblyCapacity: f.assemblyCapacity,
    }),
  };
  const clauses = [
    "CREATE (w:Workspace {id: $workspace, version: 1, settings: $settings, createdAt: $created})",
  ];
  params.workspace = workspace;
  params.created = new Date().toISOString();
  const vars: Record<string, string> = {};
  let count = 0;
  const groups: [string, { id: string; [key: string]: any }[]][] = [
    ["Source", f.sources],
    ["Factory", f.factories],
    ["Supplier", f.suppliers],
    ["Part", f.parts],
    ["Product", f.products],
    ["Order", f.orders],
    ["Offer", f.offers],
    ["Stock", [f.stock]],
  ];
  for (const [label, records] of groups)
    for (const record of records) {
      const v = "n" + count++;
      vars[record.id] = v;
      params[v] = { ...record, json: JSON.stringify(record) };
      clauses.push(
        `CREATE (${v}:Record:${label} {id: $${v}.id, name: $${v}.name, kind: '${label}', json: $${v}.json, reserved: 0, allocated: 0})`,
      );
      if (record.sourceId)
        clauses.push(
          `CREATE (${v})-[:DOCUMENTED_BY]->(${vars[record.sourceId]})`,
        );
    }
  const edge = (a: string, r: string, b: string) =>
    clauses.push(`CREATE (${vars[a]})-[:${r}]->(${vars[b]})`);
  for (const o of f.orders) edge(o.id, "ORDERS", o.productId);
  for (const p of f.products) {
    const v = "a" + count++;
    params[v] = p.id + "_assembly";
    clauses.push(
      `CREATE (${v}:Assembly {id: $${v}, name: 'Driver assembly'}) CREATE (${vars[p.id]})-[:REQUIRES]->(${v}) CREATE (${v})-[:REQUIRES]->(${vars[p.partId]})`,
    );
    for (const part of p.approvedPartIds) edge(part, "APPROVED_FOR", p.id);
  }
  for (const o of f.offers) {
    edge(o.id, "OFFERS", o.partId);
    edge(o.id, "SOLD_BY", o.supplierId);
    if (o.factoryId) edge(o.id, "SOURCED_FROM", o.factoryId);
  }
  edge(f.stock.id, "HOLDS", f.stock.partId);
  clauses.push("RETURN w.id AS id");
  await query(workspace, clauses.join("\n"), params);
  return workspace;
}
export async function getSnapshot(workspace: string): Promise<Snapshot> {
  const settings = await query(
    workspace,
    "MATCH (w:Workspace) RETURN w.settings AS settings, w.version AS version, w.disruption AS disruption, w.caseId AS caseId",
  );
  if (!settings.length) throw new Error("Workspace not found.");
  const rows = await query(
    workspace,
    "MATCH (n:Record) RETURN n.kind AS kind, n.json AS json, n.reserved AS reserved, n.allocated AS allocated",
  );
  const records = (kind: string) =>
    rows.filter((x) => x.kind === kind).map((x) => JSON.parse(x.json));
  const base = JSON.parse(settings[0].settings);
  return {
    ...base,
    sources: records("Source"),
    factories: records("Factory"),
    suppliers: records("Supplier"),
    parts: records("Part"),
    products: records("Product"),
    orders: records("Order"),
    offers: records("Offer"),
    stock: records("Stock")[0],
    version: settings[0].version,
    disruption: settings[0].disruption
      ? JSON.parse(settings[0].disruption)
      : null,
    caseId: settings[0].caseId || undefined,
    stockReserved: rows.find((x) => x.kind === "Stock")?.reserved || 0,
    offerAllocated: Object.fromEntries(
      rows
        .filter((x) => x.kind === "Offer")
        .map((x) => [JSON.parse(x.json).id, x.allocated || 0]),
    ),
  };
}
export async function recordDisruption(
  workspace: string,
  d: Disruption,
  premiumCapCents: number,
) {
  const s = await getSnapshot(workspace);
  if (s.disruption)
    throw new Error(
      "This scenario already has a disruption. Create a fresh scenario to compare.",
    );
  if (
    !s.factories.some((x) => x.id === d.factoryId) ||
    !s.sources.some((x) => x.id === d.sourceId)
  )
    throw new Error("Unknown factory or evidence.");
  const id = randomUUID(),
    settings = JSON.stringify({
      name: s.name,
      datasetKind: s.datasetKind,
      currentDay: s.currentDay,
      baselineCostCents: s.baselineCostCents,
      premiumCapCents,
      assemblyCapacity: s.assemblyCapacity,
    });
  const rows = await query(
    workspace,
    "MATCH (w:Workspace) WHERE w.version=$version SET w.disruption=$disruption, w.caseId=$caseId, w.settings=$settings, w.version=w.version+1 RETURN w.caseId AS id",
    { version: s.version, disruption: JSON.stringify(d), caseId: id, settings },
  );
  if (!rows.length) throw new Error("Workspace changed. Retry.");
  return id;
}
export async function traceImpact(workspace: string): Promise<Impact> {
  const s = await getSnapshot(workspace);
  if (!s.disruption) throw new Error("Record a disruption first.");
  const rows = await query(
    workspace,
    `MATCH p=(f:Factory {id:$factory})<-[:SOURCED_FROM]-(offer:Offer)-[:OFFERS]->(part:Part)<-[:REQUIRES*1..5]-(product:Product)<-[:ORDERS]-(o:Order) RETURN o.id AS orderId, [n IN nodes(p) | n.id] AS ids, [n IN nodes(p) | coalesce(n.name,n.id)] AS names`,
    { factory: s.disruption.factoryId },
  );
  const paths: Record<string, EvidencePath[]> = {};
  for (const row of rows) {
    const ids = row.ids as string[];
    const sourceIds = [
      s.disruption.sourceId,
      ...ids.flatMap((id) => {
        const record = [
          ...s.offers,
          ...s.parts,
          ...s.products,
          ...s.orders,
        ].find((x) => x.id === id);
        return record ? [record.sourceId] : [];
      }),
    ];
    (paths[row.orderId] ??= []).push({
      ids,
      names: row.names,
      sourceIds: [...new Set(sourceIds)],
    });
  }
  return {
    orderIds: Object.keys(paths).sort(
      (a, b) =>
        s.orders.find((o) => o.id === a)!.dueDay -
          s.orders.find((o) => o.id === b)!.dueDay || a.localeCompare(b),
    ),
    paths,
    unaffectedOrderIds: s.orders.filter((o) => !paths[o.id]).map((o) => o.id),
  };
}
export async function getCandidates(workspace: string) {
  const s = await getSnapshot(workspace),
    impact = await traceImpact(workspace);
  const exposures: Record<string, EvidencePath[]> = {};
  const rows = await query(
    workspace,
    "MATCH p=(o:Offer)-[:SOURCED_FROM*1..5]->(f:Factory {id:$factory}) RETURN o.id AS id, [n IN nodes(p)|n.id] AS ids, [n IN nodes(p)|coalesce(n.name,n.id)] AS names",
    { factory: s.disruption!.factoryId },
  );
  for (const row of rows)
    (exposures[row.id] ??= []).push({
      ids: row.ids,
      names: row.names,
      sourceIds: [
        s.offers.find((o) => o.id === row.id)!.sourceId,
        s.disruption!.sourceId,
      ],
    });
  const approvalRows = await query(
    workspace,
    "MATCH (o:Offer)-[:OFFERS]->(p:Part)-[:APPROVED_FOR]->(product:Product) RETURN o.id AS id, collect(product.id) AS products",
  );
  const approvals: Record<string, string[]> = {};
  for (const row of approvalRows) approvals[row.id] = row.products;
  return evaluateCandidates(s, impact, exposures, approvals);
}
export async function proposePlan(workspace: string) {
  const s = await getSnapshot(workspace),
    impact = await traceImpact(workspace),
    candidates = await getCandidates(workspace),
    plan = planRecovery(s, impact, candidates);
  const errors = validatePlan(s, plan, candidates);
  if (errors.length) throw new Error(errors.join(" "));
  const rows = await query(
    workspace,
    "MATCH (w:Workspace) WHERE w.version=$version CREATE (p:Plan {id:$id, version:$version, status:'proposed', json:$json})-[:IN_WORKSPACE]->(w) RETURN p.id AS id",
    { version: s.version, id: plan.id, json: JSON.stringify(plan) },
  );
  if (!rows.length)
    throw new Error("Sources changed during planning. Recalculate.");
  return { impact, candidates, plan };
}
export async function getPlans(workspace: string): Promise<Plan[]> {
  const rows = await query(
    workspace,
    "MATCH (p:Plan) RETURN p.json AS json, p.status AS status ORDER BY p.id",
  );
  return rows.map((x) => ({ ...JSON.parse(x.json), status: x.status }));
}
export async function getEvidence(workspace: string, ids: string[]) {
  return query(
    workspace,
    "MATCH (s:Source) WHERE s.id IN $ids RETURN s.json AS json",
    { ids },
  ).then((rows) => rows.map((x) => JSON.parse(x.json)));
}
export async function appendActivity(
  workspace: string,
  event: {
    tool: string;
    input: unknown;
    output: unknown;
    durationMs: number;
    error?: string;
  },
) {
  await query(
    workspace,
    "CREATE (a:Activity {id:$id, at:$at, json:$json}) RETURN a.id AS id",
    {
      id: randomUUID(),
      at: new Date().toISOString(),
      json: JSON.stringify(event),
    },
  );
}
export async function getActivity(workspace: string) {
  return query(
    workspace,
    "MATCH (a:Activity) RETURN a.at AS at,a.json AS json ORDER BY a.at",
  ).then((rows) => rows.map((x) => ({ at: x.at, ...JSON.parse(x.json) })));
}
export async function approvePlan(workspace: string, id: string) {
  const s = await getSnapshot(workspace),
    p = (await getPlans(workspace)).find((x) => x.id === id);
  if (!p) throw new Error("Plan not found.");
  if (p.status === "verified" || p.status === "committed")
    return { alreadyApplied: true, plan: p };
  if (p.version !== s.version)
    throw new Error("Source data changed. Recalculate and approve a new plan.");
  const approvalId = randomUUID();
  await query(
    workspace,
    "MATCH(p:Plan {id:$id}) WHERE p.status='proposed' CREATE(a:Approval {id:$approval,version:$version})-[:APPROVES]->(p) RETURN a.id AS id",
    { id, approval: approvalId, version: s.version },
  );
  return { approvalId, plan: p };
}
export async function commitPlan(
  workspace: string,
  id: string,
  approvalId: string,
) {
  const s = await getSnapshot(workspace),
    plan = (await getPlans(workspace)).find((x) => x.id === id);
  if (!plan) throw new Error("Plan not found.");
  if (plan.status === "verified" || plan.status === "committed")
    return verifyPlan(workspace, id);
  const candidates = await getCandidates(workspace),
    errors = validatePlan(s, plan, candidates);
  if (errors.length) throw new Error(errors.join(" "));
  const params: Record<string, any> = {
    id,
    approval: approvalId,
    version: plan.version,
    stock: plan.stockUsed,
    requisition: "REQ-" + id.slice(0, 8),
    json: JSON.stringify({
      ...plan,
      status: "committed",
      requisitionId: "REQ-" + id.slice(0, 8),
    }),
  };
  const matches = [
    "MATCH(w:Workspace),(p:Plan {id:$id}),(a:Approval {id:$approval})-[:APPROVES]->(p),(stock:Stock)",
  ];
  let index = 0;
  for (const [offerId, q] of Object.entries(plan.purchased)) {
    params["offer" + index] = offerId;
    params["q" + index] = q;
    matches.push(`MATCH(o${index}:Offer {id:$offer${index}})`);
    index++;
  }
  const clauses = [
    ...matches,
    "WHERE w.version=$version AND p.version=$version AND a.version=$version AND p.status='proposed'",
    "SET stock.reserved=stock.reserved+$stock, w.version=w.version+1, p.status='committed', p.json=$json, a.used=true",
    "CREATE(r:Requisition {id:$requisition,status:'draft'})-[:FOR_PLAN]->(p)",
  ];
  index = 0;
  for (const [offerId, q] of Object.entries(plan.purchased)) {
    clauses.push(
      `SET o${index}.allocated=o${index}.allocated+$q${index} CREATE (r)-[:REQUESTS {quantity:$q${index}}]->(o${index})`,
    );
    index++;
  }
  for (let i = 0; i < plan.allocations.length; i++) {
    const allocation = plan.allocations[i];
    params["alloc" + i] = JSON.stringify(allocation);
    params["order" + i] = allocation.orderId;
    clauses.push(
      `CREATE(al${i}:Allocation {id:$order${i},json:$alloc${i}})-[:FROM_PLAN]->(p)`,
    );
  }
  clauses.push("RETURN p.id AS id");
  const result = await query(workspace, clauses.join("\n"), params);
  if (!result.length)
    throw new Error("Plan or sources changed. Recalculate before approval.");
  return verifyPlan(workspace, id);
}
export async function verifyPlan(workspace: string, id: string) {
  const plan = (await getPlans(workspace)).find((x) => x.id === id);
  if (!plan || plan.status === "proposed")
    throw new Error("Plan has not been applied.");
  const rows = await query(
    workspace,
    "MATCH (a:Allocation)-[:FROM_PLAN]->(p:Plan {id:$id}) RETURN a.json AS json",
    { id },
  );
  const allocations = rows.map((x) => JSON.parse(x.json));
  const requisition = await query(
    workspace,
    "MATCH (r:Requisition)-[:FOR_PLAN]->(p:Plan {id:$id}) RETURN r.id AS id,r.status AS status",
    { id },
  );
  const snapshot = await getSnapshot(workspace);
  const expected = JSON.stringify(
      [...plan.allocations].sort((a, b) => a.orderId.localeCompare(b.orderId)),
    ),
    actual = JSON.stringify(
      allocations.sort((a: any, b: any) => a.orderId.localeCompare(b.orderId)),
    );
  const verified =
    expected === actual &&
    requisition.length === 1 &&
    snapshot.stockReserved >= plan.stockUsed &&
    Object.entries(plan.purchased).every(
      ([key, q]) => (snapshot.offerAllocated[key] || 0) >= q,
    );
  if (!verified) throw new Error("Saved plan failed readback verification.");
  await query(
    workspace,
    "MATCH(p:Plan {id:$id}) SET p.status='verified' RETURN p.id AS id",
    { id },
  );
  return {
    verified: true,
    plan: { ...plan, status: "verified" },
    requisition: requisition[0],
    allocations,
  };
}
export async function updateOffer(
  workspace: string,
  id: string,
  quantity: number,
) {
  const s = await getSnapshot(workspace),
    offer = s.offers.find((o) => o.id === id);
  if (!offer) throw new Error("Offer not found.");
  if (s.offerAllocated[id] > quantity)
    throw new Error(
      "Quantity is below existing planned allocations. Create a fresh scenario.",
    );
  const next = { ...offer, quantity };
  const source = s.sources.find((x) => x.id === offer.sourceId)!;
  const newSource = {
    ...source,
    updatedAt: new Date().toISOString(),
    detail: `Revised quote: ${quantity} units available. Previous declaration: ${source.detail}`,
  };
  await query(
    workspace,
    "MATCH(w:Workspace),(o:Offer {id:$id}),(s:Source {id:$sourceId}) WHERE w.version=$version SET o.json=$json,s.json=$source,w.version=w.version+1 RETURN o.id AS id",
    {
      id,
      sourceId: source.id,
      version: s.version,
      json: JSON.stringify(next),
      source: JSON.stringify(newSource),
    },
  );
}
