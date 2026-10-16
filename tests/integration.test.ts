import { afterAll, describe, it, expect } from "vitest";
import { sampleFixture } from "../src/domain/fixture.js";
import {
  createWorkspace,
  recordDisruption,
  traceImpact,
  getCandidates,
  proposePlan,
  approvePlan,
  commitPlan,
  getSnapshot,
  updateOffer,
  closeDb,
  getPlans,
} from "../src/graph/store.js";
async function scenario(quantity = 80) {
  const id = await createWorkspace(sampleFixture(quantity));
  await recordDisruption(
    id,
    { factoryId: "factory_z", untilDay: 8, sourceId: "src_notice" },
    20000,
  );
  return id;
}
afterAll(closeDb);
describe("FalkorDB recovery workflow", () => {
  it("traverses actual manufacturing and factory exposure relationships", async () => {
    const w = await scenario(),
      i = await traceImpact(w);
    expect(i.orderIds.sort()).toEqual(["O-101", "O-102"]);
    expect(i.unaffectedOrderIds).toEqual(["O-103"]);
    expect(i.paths["O-101"][0].ids).toContain("desk_assembly");
    const c = await getCandidates(w);
    expect(c.filter((x) => x.eligible).map((x) => x.offerId)).toEqual([
      "offer_d",
    ]);
    expect(
      c.find((x) => x.offerId === "offer_b")?.exposurePaths[0].ids,
    ).toContain("factory_z");
  });
  it("persists and verifies allocations once, including concurrent retries", async () => {
    const w = await scenario(),
      { plan } = await proposePlan(w),
      approval = await approvePlan(w, plan.id);
    const results = await Promise.allSettled([
      commitPlan(w, plan.id, approval.approvalId!),
      commitPlan(w, plan.id, approval.approvalId!),
    ]);
    expect(results.some((x) => x.status === "fulfilled")).toBe(true);
    const s = await getSnapshot(w);
    expect(s.stockReserved).toBe(20);
    expect(s.offerAllocated.offer_d).toBe(80);
    expect((await getPlans(w))[0].status).toBe("verified");
    expect((await commitPlan(w, plan.id, approval.approvalId!)).verified).toBe(
      true,
    );
    expect((await getSnapshot(w)).stockReserved).toBe(20);
    await expect(proposePlan(w)).rejects.toThrow(/already recorded/);
  });
  it("blocks stale approval after a source update", async () => {
    const w = await scenario(),
      { plan } = await proposePlan(w),
      approval = await approvePlan(w, plan.id);
    await updateOffer(w, "offer_d", 50);
    await expect(commitPlan(w, plan.id, approval.approvalId!)).rejects.toThrow(
      /changed/,
    );
    expect((await getSnapshot(w)).stockReserved).toBe(0);
    const next = await proposePlan(w);
    expect(next.plan.remainingShortage).toBe(30);
  });
  it("keeps workspace state isolated and supports a new dataset", async () => {
    const a = await scenario(50),
      b = await scenario();
    expect((await proposePlan(a)).plan.remainingShortage).toBe(30);
    expect((await proposePlan(b)).plan.remainingShortage).toBe(0);
  });
  it("plans an imported dataset with independently named record IDs", async () => {
    const f = sampleFixture();
    const records = [
      ...f.sources,
      ...f.factories,
      ...f.suppliers,
      ...f.parts,
      ...f.products,
      ...f.orders,
      ...f.offers,
      f.stock,
    ];
    const ids = new Map(records.map((r) => [r.id, "custom_" + r.id]));
    const rename = (value: any): any =>
      Array.isArray(value)
        ? value.map(rename)
        : value && typeof value === "object"
          ? Object.fromEntries(
              Object.entries(value).map(([k, v]) => [k, rename(v)]),
            )
          : typeof value === "string"
            ? ids.get(value) || value
            : value;
    const custom = rename(f);
    custom.name = "Workshop Supply";
    const w = await createWorkspace(custom);
    await recordDisruption(
      w,
      {
        factoryId: "custom_factory_z",
        sourceId: "custom_src_notice",
        untilDay: 8,
      },
      20000,
    );
    const { plan, impact } = await proposePlan(w);
    expect(impact.orderIds).toEqual(["custom_O-101", "custom_O-102"]);
    expect(plan.purchased).toEqual({ custom_offer_d: 80 });
    expect(plan.premiumCents).toBe(16000);
  });
});
