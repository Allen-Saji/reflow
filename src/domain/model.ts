import { z } from "zod";
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const qty = z.number().int().min(0).max(1000);
const day = z.number().int().min(0).max(365);
export const sourceSchema = z.object({
  id,
  title: z.string().min(1).max(160),
  kind: z.string().max(50),
  updatedAt: z.string(),
  detail: z.string().max(2000),
});
export const fixtureSchema = z.object({
  datasetKind: z.enum(["synthetic", "public"]).default("synthetic"),
  name: z.string().min(1).max(120),
  currentDay: day,
  baselineCostCents: z.number().int().min(0).max(100000),
  premiumCapCents: z.number().int().min(0).max(1000000),
  assemblyCapacity: qty,
  sources: z.array(sourceSchema).min(1).max(100),
  factories: z
    .array(z.object({ id, name: z.string().max(120), sourceId: id }))
    .min(1)
    .max(20),
  suppliers: z
    .array(z.object({ id, name: z.string().max(120), sourceId: id }))
    .min(1)
    .max(20),
  parts: z
    .array(
      z.object({ id, name: z.string().max(120), voltage: qty, sourceId: id }),
    )
    .min(1)
    .max(20),
  products: z
    .array(
      z.object({
        id,
        name: z.string().max(120),
        partId: id,
        requiredVoltage: qty,
        approvedPartIds: z.array(id).min(1).max(10),
        assemblyDays: day,
        deliveryDays: day,
        sourceId: id,
      }),
    )
    .min(1)
    .max(6),
  orders: z
    .array(
      z.object({
        id,
        customer: z.string().max(120),
        productId: id,
        quantity: qty.refine((v) => v > 0),
        dueDay: day,
        sourceId: id,
      }),
    )
    .min(1)
    .max(3),
  offers: z
    .array(
      z.object({
        id,
        supplierId: id,
        partId: id,
        factoryId: id.nullable(),
        upstreamKnown: z.boolean(),
        quantity: qty,
        independentStock: qty,
        arrivalDay: day,
        unitCostCents: z.number().int().min(0).max(100000),
        validUntilDay: day,
        sourceId: id,
      }),
    )
    .min(1)
    .max(4),
  stock: z.object({ id, partId: id, quantity: qty, sourceId: id }),
});
export type Fixture = z.infer<typeof fixtureSchema>;
export type Source = z.infer<typeof sourceSchema>;
export type Disruption = {
  factoryId: string;
  untilDay: number;
  sourceId: string;
};
export type Snapshot = Fixture & {
  version: number;
  disruption: Disruption | null;
  stockReserved: number;
  offerAllocated: Record<string, number>;
  caseId?: string;
};
export type EvidencePath = {
  ids: string[];
  names: string[];
  sourceIds: string[];
};
export type Impact = {
  orderIds: string[];
  paths: Record<string, EvidencePath[]>;
  unaffectedOrderIds: string[];
};
export type Candidate = {
  offerId: string;
  supplierId: string;
  eligible: boolean;
  reasons: string[];
  usableQuantity: number;
  exposed: boolean;
  exposurePaths: EvidencePath[];
  approvedProductIds: string[];
  sourceIds: string[];
};
export type Allocation = {
  orderId: string;
  stockQuantity: number;
  offerQuantities: Record<string, number>;
  covered: number;
  shortage: number;
  projectedDay: number | null;
  complete: boolean;
};
export type Plan = {
  id: string;
  version: number;
  status: "proposed" | "committed" | "verified";
  allocations: Allocation[];
  purchased: Record<string, number>;
  stockUsed: number;
  purchaseCents: number;
  premiumCents: number;
  completeOrders: number;
  totalAffected: number;
  remainingShortage: number;
  exhausted: boolean;
  evaluated: number;
  evidenceIds: string[];
  createdAt: string;
  requisitionId?: string;
};
export function validateFixture(value: unknown): Fixture {
  const f = fixtureSchema.parse(value);
  const all = [
    ...f.sources,
    ...f.factories,
    ...f.suppliers,
    ...f.parts,
    ...f.products,
    ...f.orders,
    ...f.offers,
    f.stock,
  ];
  const ids = all.map((x) => x.id);
  if (new Set(ids).size !== ids.length)
    throw new Error("Record IDs must be unique.");
  const has = (xs: { id: string }[], v: string) => xs.some((x) => x.id === v);
  for (const r of all)
    if ("sourceId" in r && !has(f.sources, r.sourceId))
      throw new Error(`Unknown source for ${r.id}.`);
  for (const p of f.products)
    if (
      !has(f.parts, p.partId) ||
      p.approvedPartIds.some((v) => !has(f.parts, v))
    )
      throw new Error(`Invalid part reference for ${p.id}.`);
  for (const o of f.orders)
    if (!has(f.products, o.productId))
      throw new Error(`Invalid product reference for ${o.id}.`);
  for (const o of f.offers)
    if (
      !has(f.suppliers, o.supplierId) ||
      !has(f.parts, o.partId) ||
      (o.factoryId && !has(f.factories, o.factoryId)) ||
      (o.upstreamKnown && !o.factoryId) ||
      o.independentStock > o.quantity
    )
      throw new Error(`Invalid offer reference/stock for ${o.id}.`);
  if (!has(f.parts, f.stock.partId)) throw new Error("Invalid inventory part.");
  if (f.orders.reduce((n, o) => n + o.quantity, 0) > 250)
    throw new Error("This planner supports at most 250 total units.");
  return f;
}
