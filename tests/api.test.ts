import { describe, it, expect, afterAll } from "vitest";
import { buildApp } from "../src/server/app.js";
import { closeDb } from "../src/graph/store.js";
const app = await buildApp();
afterAll(async () => {
  await app.close();
  await closeDb();
});
async function workspace(variant = "base") {
  const r = await app.inject({
    method: "POST",
    url: "/api/workspaces",
    payload: { variant },
  });
  expect(r.statusCode).toBe(200);
  return {
    cookie: r.cookies.map((c) => c.name + "=" + c.value).join("; "),
    id: r.json().id,
  };
}
describe("public application boundary", () => {
  it("requires a signed workspace session and prevents switching to another visitor workspace", async () => {
    expect((await app.inject("/api/state")).statusCode).toBe(400);
    const a = await workspace(),
      b = await workspace();
    const r = await app.inject({
      method: "POST",
      url: "/api/workspaces/" + b.id + "/select",
      headers: { cookie: a.cookie },
      payload: {},
    });
    expect(r.statusCode).toBe(403);
    expect(
      (
        await app.inject({ url: "/api/state", headers: { cookie: a.cookie } })
      ).json().id,
    ).toBe(a.id);
  });
  it("completes investigation, approval and saved receipt through HTTP and MCP", async () => {
    const w = await workspace();
    const headers = { cookie: w.cookie };
    const c = await app.inject({
      method: "POST",
      url: "/api/cases",
      headers,
      payload: {
        factoryId: "factory_z",
        untilDay: 8,
        sourceId: "src_notice",
        premiumCapCents: 20000,
      },
    });
    expect(c.statusCode).toBe(200);
    const r = await app.inject({
      method: "POST",
      url: "/api/investigate",
      headers,
      payload: { request: "Find a recovery plan.", mode: "guided" },
    });
    expect(r.statusCode).toBe(200);
    const events = r.body
      .trim()
      .split("\n")
      .map((l) => JSON.parse(l));
    expect(events.filter((e) => e.type === "tool")).toHaveLength(3);
    const id = events.at(-1).result.planId;
    const a = await app.inject({
      method: "POST",
      url: "/api/plans/" + id + "/approve",
      headers,
      payload: {},
    });
    expect(a.json().verified).toBe(true);
    const s = (await app.inject({ url: "/api/state", headers })).json();
    expect(s.snapshot.stockReserved).toBe(20);
    expect(s.plans.find((p: any) => p.id === id).status).toBe("verified");
  });
  it("rejects invalid imports before creating a graph", async () => {
    const r = await app.inject({
      method: "POST",
      url: "/api/workspaces",
      payload: { fixture: { name: "Incomplete" } },
    });
    expect(r.statusCode).toBe(400);
  });
});
