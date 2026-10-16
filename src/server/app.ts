import "dotenv/config";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import serveStatic from "@fastify/static";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { sampleFixture } from "../domain/fixture.js";
import {
  createWorkspace,
  getSnapshot,
  recordDisruption,
  traceImpact,
  getCandidates,
  getPlans,
  getActivity,
  approvePlan,
  updateOffer,
  validWorkspace,
  db,
} from "../graph/store.js";
import { investigate } from "./agent.js";
import { withMcp, callTool } from "./mcp.js";
export async function buildApp() {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || "warn",
      redact: ["req.headers.authorization", "req.headers.cookie"],
    },
    bodyLimit: 200000,
  });
  if (process.env.NODE_ENV === "production" && !process.env.COOKIE_SECRET)
    throw new Error("COOKIE_SECRET is required in production.");
  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET || randomBytes(32).toString("hex"),
  });
  await app.register(rateLimit, { max: 120, timeWindow: "1 minute" });
  const running = new Set<string>();
  const agentRuns = new Map<string, number>();
  let dailyRuns = 0;
  let usageDay = new Date().toISOString().slice(0, 10);
  function memberships(req: any): string[] {
    const value = req.cookies.sr_session;
    if (!value) return [];
    const checked = req.unsignCookie(value);
    if (!checked.valid) return [];
    try {
      const ids = JSON.parse(checked.value);
      return Array.isArray(ids)
        ? ids.filter((x) => typeof x === "string" && validWorkspace(x))
        : [];
    } catch {
      return [];
    }
  }
  function select(req: any) {
    const ids = memberships(req);
    if (!ids.length) throw new Error("Open a sample workspace first.");
    return ids.at(-1)!;
  }
  function setMembers(reply: any, ids: string[]) {
    reply.setCookie("sr_session", JSON.stringify(ids.slice(-8)), {
      httpOnly: true,
      sameSite: "strict",
      signed: true,
      path: "/",
      secure: process.env.COOKIE_SECURE === "true",
      maxAge: 60 * 60 * 24 * 3,
    });
  }
  app.setErrorHandler((error: any, _req, reply) => {
    const code = error instanceof z.ZodError ? 400 : error.statusCode || 400;
    reply.code(code).send({
      error:
        error instanceof z.ZodError
          ? "Invalid request. Check the values and supported limits."
          : error.message || "Request failed.",
    });
  });
  app.get("/api/health", async (_req, reply) => {
    try {
      await (await db()).list();
      return { ok: true, database: "connected" };
    } catch {
      return reply.code(503).send({ ok: false, database: "unavailable" });
    }
  });
  app.post(
    "/api/workspaces",
    { config: { rateLimit: { max: 20, timeWindow: "1 hour" } } },
    async (req, reply) => {
      const body = z
        .object({
          variant: z.enum(["base", "shortage"]).default("base"),
          fixture: z.unknown().optional(),
        })
        .parse(req.body || {});
      const id = await createWorkspace(
        (body.fixture as any) ||
          sampleFixture(body.variant === "shortage" ? 50 : 80),
      );
      setMembers(reply, [...memberships(req), id]);
      return { id };
    },
  );
  app.get("/api/workspaces", async (req) => {
    const ids = memberships(req);
    return Promise.all(
      ids.map(async (id) => ({ id, name: (await getSnapshot(id)).name })),
    );
  });
  app.post("/api/workspaces/:id/select", async (req, reply) => {
    const id = z.object({ id: z.string() }).parse(req.params).id,
      ids = memberships(req);
    if (!ids.includes(id))
      return reply.code(403).send({ error: "Workspace not authorized." });
    setMembers(reply, [...ids.filter((x) => x !== id), id]);
    return { id };
  });
  app.get("/api/state", async (req) => {
    const id = select(req),
      snapshot = await getSnapshot(id);
    return {
      id,
      snapshot,
      impact: snapshot.disruption ? await traceImpact(id) : null,
      candidates: snapshot.disruption ? await getCandidates(id) : [],
      plans: await getPlans(id),
      activity: await getActivity(id),
      agentAvailable: !!process.env.OPENROUTER_API_KEY,
    };
  });
  app.post("/api/cases", async (req) => {
    const id = select(req);
    if (running.has(id)) throw new Error("Investigation in progress.");
    const body = z
      .object({
        factoryId: z.string().max(80),
        untilDay: z.number().int().min(0).max(365),
        sourceId: z.string().max(80),
        premiumCapCents: z.number().int().min(0).max(1000000),
      })
      .parse(req.body);
    return { id: await recordDisruption(id, body, body.premiumCapCents) };
  });
  app.post("/api/offers/:id", async (req) => {
    const id = select(req);
    if (running.has(id))
      throw new Error("Wait for the investigation to finish.");
    const offer = z.object({ id: z.string().max(80) }).parse(req.params).id;
    const body = z
      .object({ quantity: z.number().int().min(0).max(1000) })
      .parse(req.body);
    await updateOffer(id, offer, body.quantity);
    return { ok: true };
  });
  app.post("/api/investigate", async (req, reply) => {
    const id = select(req),
      body = z
        .object({
          request: z.string().min(1).max(1000),
          mode: z.enum(["agent", "guided"]).default("agent"),
        })
        .parse(req.body);
    if (running.has(id))
      throw new Error("An investigation is already running.");
    if (running.size >= 3)
      throw new Error("All investigation slots are in use. Try again shortly.");
    if (body.mode === "agent") {
      const today = new Date().toISOString().slice(0, 10);
      if (today !== usageDay) {
        dailyRuns = 0;
        usageDay = today;
        agentRuns.clear();
      }
      if ((agentRuns.get(id) || 0) >= 3)
        throw new Error(
          "Autonomous run limit reached for this workspace. Guided investigation is still available.",
        );
      if (dailyRuns >= Number(process.env.DAILY_AGENT_RUN_LIMIT || 40))
        throw new Error(
          "Today's autonomous run limit has been reached. Guided investigation is still available.",
        );
      agentRuns.set(id, (agentRuns.get(id) || 0) + 1);
      dailyRuns++;
    }
    running.add(id);
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    const send = (event: unknown) => {
      if (!reply.raw.destroyed) reply.raw.write(JSON.stringify(event) + "\n");
    };
    try {
      const result = await investigate(
        id,
        body.request,
        (event) => send({ type: "tool", event }),
        body.mode,
      );
      send({ type: "complete", result });
    } catch (e) {
      send({
        type: "error",
        error: e instanceof Error ? e.message : "Investigation failed.",
      });
    } finally {
      running.delete(id);
      reply.raw.end();
    }
  });
  app.post("/api/plans/:id/approve", async (req) => {
    const w = select(req);
    if (running.has(w))
      throw new Error("Wait for the investigation to finish.");
    const id = z.object({ id: z.string().uuid() }).parse(req.params).id;
    const approval = await approvePlan(w, id);
    return withMcp(w, (client) =>
      approval.alreadyApplied
        ? callTool(client, "verify_recovery_plan", { planId: id })
        : callTool(client, "commit_approved_plan", {
            planId: id,
            approvalId: approval.approvalId,
          }),
    );
  });
  if (existsSync(resolve("dist/index.html"))) {
    await app.register(serveStatic, { root: resolve("dist"), wildcard: true });
    app.setNotFoundHandler((req, reply) =>
      req.url.startsWith("/api/") || req.url.startsWith("/assets/")
        ? reply.code(404).send({ error: "Not found." })
        : reply.sendFile("index.html"),
    );
  }
  return app;
}
