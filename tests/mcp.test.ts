import { it, expect, afterAll } from "vitest";
import {
  createWorkspace,
  recordDisruption,
  approvePlan,
  closeDb,
} from "../src/graph/store.js";
import { withMcp, callTool } from "../src/server/mcp.js";
afterAll(closeDb);
it("discovers and executes actual MCP tools through a protocol connection", async () => {
  const w = await createWorkspace();
  await recordDisruption(
    w,
    { factoryId: "factory_z", untilDay: 8, sourceId: "src_notice" },
    20000,
  );
  await withMcp(w, async (client) => {
    const tools = await client.listTools();
    expect(tools.tools.map((x) => x.name)).toContain("trace_disruption");
    expect(
      (await callTool(client, "trace_disruption")).impact.orderIds,
    ).toHaveLength(2);
    const result = await callTool(client, "evaluate_recovery_options");
    await expect(
      callTool(client, "commit_approved_plan", {
        planId: result.plan.id,
        approvalId: "00000000-0000-4000-8000-000000000000",
      }),
    ).rejects.toThrow();
    const approval = await approvePlan(w, result.plan.id);
    expect(
      (
        await callTool(client, "commit_approved_plan", {
          planId: result.plan.id,
          approvalId: approval.approvalId,
        })
      ).verified,
    ).toBe(true);
  });
});
