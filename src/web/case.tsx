import { useContext, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  ArrowRight,
  ArrowUpRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  AlertTriangle,
  Network,
  Package,
  FileText,
  X,
  RefreshCw,
  LoaderCircle,
  ChevronRight,
  Download,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { useReveal } from "./motion";
import { api, money, download } from "./api";
import { Source, Plan } from "../domain/model";
import { Context } from "./context";
import {
  Badge,
  Button,
  PageHead,
  OrdersTable,
  PathView,
  useModalFocus,
  moveTab,
} from "./ui";
const toolsLabel: Record<string, string> = {
  trace_disruption: "Traced the affected customer orders",
  find_replacement_offers: "Checked replacement sources",
  get_evidence: "Read supporting source records",
  evaluate_recovery_options: "Calculated a recovery proposal",
  commit_approved_plan: "Applied the approved internal changes",
  verify_recovery_plan: "Verified saved recovery records",
};
export function RecoveryCase() {
  const { state, reload, inspect, setError } = useContext(Context);
  const s = state!.snapshot,
    { id } = useParams(),
    [tab, setTab] = useState("impact"),
    [selectedOrder, setSelectedOrder] = useState(""),
    [selectedOffer, setSelectedOffer] = useState("offer_b"),
    [busy, setBusy] = useState(false),
    [events, setEvents] = useState<{ tool: string; durationMs: number }[]>([]),
    [summary, setSummary] = useState(""),
    [mode, setMode] = useState(state!.agentAvailable ? "agent" : "guided"),
    [confirm, setConfirm] = useState(false),
    [request, setRequest] = useState(
      "Investigate this factory disruption and recover the affected orders within the recorded premium cap. Explain rejected alternatives and any remaining shortage.",
    );
  const reveal = useReveal<HTMLElement>(tab);
  const focus = useModalFocus(confirm, () => setConfirm(false));
  const plans = [...state!.plans].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const plan = plans.find((p) => p.status === "verified") || plans[0];
  const verified = plan?.status === "verified",
    stale = !!plan && plan.status === "proposed" && plan.version !== s.version;
  const candidates = state!.candidates;
  const selected =
    candidates.find((c) => c.offerId === selectedOffer) || candidates[0];
  const offer = s.offers.find((o) => o.id === selected?.offerId);
  const orderId = selectedOrder || state!.impact?.orderIds[0] || "";
  async function run() {
    setBusy(true);
    setError("");
    setSummary("");
    setEvents([]);
    try {
      const response = await fetch("/api/investigate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request, mode }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || "Investigation failed.");
      }
      const reader = response.body!.getReader(),
        decoder = new TextDecoder();
      let pending = "";
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        pending += decoder.decode(chunk.value, { stream: true });
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "tool") setEvents((old) => [...old, event.event]);
          if (event.type === "error") throw new Error(event.error);
          if (event.type === "complete") {
            setSummary(event.result.summary);
            setTab("options");
          }
        }
      }
      await reload();
    } catch (e) {
      setError((e as Error).message);
      await reload();
    } finally {
      setBusy(false);
    }
  }
  async function approve() {
    if (!plan) return;
    setBusy(true);
    setConfirm(false);
    try {
      await api("/plans/" + plan.id + "/approve", {});
      await reload();
      setTab("plan");
    } catch (e) {
      setError((e as Error).message);
      await reload();
    } finally {
      setBusy(false);
    }
  }
  if (!s.disruption || id !== s.caseId)
    return (
      <main className="page">
        <h1>Open a case in this scenario.</h1>
        <Link className="button" to="/app">
          Return to operations
        </Link>
      </main>
    );
  return (
    <main className="page case-page" ref={reveal}>
      <Link className="back-link" to="/app">
        <ArrowLeft size={14} />
        Operations
      </Link>
      <PageHead
        eyebrow={"RECOVERY CASE / " + s.caseId?.slice(0, 8).toUpperCase()}
        title={
          (s.factories.find((f) => f.id === s.disruption!.factoryId)?.name ||
            "Factory") + " supply disruption"
        }
        description={
          "Unavailable through Day " +
          s.disruption.untilDay +
          ". Recover customer commitments within " +
          money(s.premiumCapCents) +
          " additional cost."
        }
        action={
          <Badge tone={verified ? "green" : stale ? "red" : "amber"}>
            {verified
              ? "Plan verified"
              : stale
                ? "Needs revision"
                : busy
                  ? "Working"
                  : plan
                    ? "Ready for approval"
                    : "Investigation needed"}
          </Badge>
        }
      />
      <div className="case-stats">
        <span>
          <strong>{state!.impact?.orderIds.length || 0}</strong> orders affected
        </span>
        <span>
          <strong>
            {s.orders
              .filter((o) => state!.impact?.orderIds.includes(o.id))
              .reduce((n, o) => n + o.quantity, 0)}
          </strong>{" "}
          component units required
        </span>
        <span>
          <strong>{s.stock.quantity - s.stockReserved}</strong> unallocated on
          hand
        </span>
        <span className="case-reference">
          <FileText size={14} />
          <button
            className="text-button"
            onClick={() => inspect([s.disruption!.sourceId])}
          >
            Disruption notice
          </button>
        </span>
      </div>
      <div
        className="case-tabs"
        role="tablist"
        aria-label="Recovery case sections"
        onKeyDown={(event) =>
          moveTab(event, ["impact", "options", "plan", "activity"], tab, setTab)
        }
      >
        {["impact", "options", "plan", "activity"].map((t, i) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
            className={tab === t ? "active" : ""}
            onClick={() => setTab(t)}
          >
            <span className="mono">0{i + 1}</span>
            {t[0].toUpperCase() + t.slice(1)}
            {t === "plan" && verified && <Check size={14} />}
          </button>
        ))}
      </div>
      {tab === "impact" && (
        <>
          <div className="section-head">
            <div>
              <h2>Follow the exposure.</h2>
              <p>
                Select an order to see how it connects to the disrupted factory.
              </p>
            </div>
          </div>
          <OrdersTable />
          <div className="section-head">
            <h3>Relationship evidence</h3>
            <select
              aria-label="Order evidence path"
              value={orderId}
              onChange={(e) => setSelectedOrder(e.target.value)}
            >
              {state!.impact?.orderIds.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
          <PathView paths={state!.impact?.paths[orderId] || []} />
          {!verified && (
            <section className="investigation-panel">
              <div>
                <div className="eyebrow">THE NEXT DECISION</div>
                <h2>Find a workable replacement.</h2>
                <p>
                  The agent checks recorded alternatives against dependencies,
                  specifications, availability and delivery constraints.
                </p>
              </div>
              <label className="request-label">
                Investigation request
                <textarea
                  value={request}
                  maxLength={1000}
                  onChange={(e) => setRequest(e.target.value)}
                />
              </label>
              <div className="investigation-actions">
                <select
                  aria-label="Investigation mode"
                  value={mode}
                  disabled={busy}
                  onChange={(e) => setMode(e.target.value)}
                >
                  {state!.agentAvailable && (
                    <option value="agent">Autonomous agent / MCP</option>
                  )}
                  <option value="guided">Guided investigation / MCP</option>
                </select>
                <Button disabled={busy || !request.trim()} onClick={run}>
                  {busy ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Network size={17} />
                  )}{" "}
                  {busy ? "Investigating" : "Find recovery options"}{" "}
                  {!busy && <ArrowRight size={17} />}
                </Button>
              </div>
              {events.length > 0 && (
                <div className="live-events" aria-live="polite">
                  {events.map((event, i) => (
                    <div key={i}>
                      <Check size={14} />
                      {toolsLabel[event.tool] || event.tool}
                      <span className="mono">{event.durationMs} ms</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}
      {tab === "options" && (
        <>
          <div className="section-head">
            <div>
              <h2>A different name is only the start.</h2>
              <p>Compare the recorded offer and its upstream dependencies.</p>
            </div>
            {plan && (
              <Button onClick={() => setTab("plan")}>
                Review recovery plan <ArrowRight size={16} />
              </Button>
            )}
          </div>
          {summary && (
            <div className="agent-summary">
              <Network size={18} />
              <div>
                <strong>
                  {mode === "agent"
                    ? "Agent investigation"
                    : "Guided investigation"}
                </strong>
                <p>{summary}</p>
              </div>
            </div>
          )}
          <div className="table-wrap">
            <table className="options-table">
              <thead>
                <tr>
                  <th>Supplier / offer</th>
                  <th>Units</th>
                  <th>Arrival</th>
                  <th>Unit cost</th>
                  <th>Assessment</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => {
                  const o = s.offers.find((o) => o.id === c.offerId)!;
                  return (
                    <tr
                      className={
                        selected?.offerId === c.offerId ? "selected-row" : ""
                      }
                      key={c.offerId}
                    >
                      <td>
                        <strong>
                          {s.suppliers.find((x) => x.id === c.supplierId)?.name}
                        </strong>
                        <small className="mono">{c.offerId}</small>
                      </td>
                      <td className="mono">
                        {c.eligible ? c.usableQuantity : 0}
                        <small>{o.quantity} quoted</small>
                      </td>
                      <td className="mono">Day {o.arrivalDay}</td>
                      <td className="mono">{money(o.unitCostCents)}</td>
                      <td>
                        <Badge tone={c.eligible ? "green" : "red"}>
                          {c.eligible ? "Eligible" : "Blocked"}
                        </Badge>
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => setSelectedOffer(c.offerId)}
                        >
                          Inspect <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {selected && offer && (
            <section className="assessment panel">
              <div className="section-head">
                <div>
                  <div className="eyebrow">
                    WHY THIS OPTION{" "}
                    {selected.eligible ? "QUALIFIES" : "IS BLOCKED"}
                  </div>
                  <h2>
                    {
                      s.suppliers.find((x) => x.id === selected.supplierId)
                        ?.name
                    }
                  </h2>
                </div>
                <Button
                  kind="quiet"
                  onClick={() => inspect(selected.sourceIds)}
                >
                  Read evidence <FileText size={16} />
                </Button>
              </div>
              {selected.eligible ? (
                <p className="assessment-result">
                  <CheckCircle2 size={19} />
                  Approved component and recorded source evidence meet the
                  current constraints. Feasibility still depends on the full
                  allocation plan.
                </p>
              ) : (
                <ul className="reason-list">
                  {selected.reasons.map((r) => (
                    <li key={r}>
                      <AlertTriangle size={16} />
                      {r}
                    </li>
                  ))}
                </ul>
              )}
              {selected.exposurePaths.length > 0 ? (
                <PathView paths={selected.exposurePaths} />
              ) : (
                <div className="source-facts">
                  <div>
                    <span>Component</span>
                    <strong>
                      {s.parts.find((p) => p.id === offer.partId)?.name}
                    </strong>
                  </div>
                  <div>
                    <span>Recorded factory</span>
                    <strong>
                      {s.factories.find((f) => f.id === offer.factoryId)
                        ?.name || "Not verified"}
                    </strong>
                  </div>
                  <div>
                    <span>Quote valid through</span>
                    <strong>Day {offer.validUntilDay}</strong>
                  </div>
                  <p>
                    No affected upstream path was returned in the modeled supply
                    network. Review the source declaration before relying on it.
                  </p>
                </div>
              )}
            </section>
          )}
          {!plan && (
            <div className="notice">
              Run the investigation from Impact to compute and save a recovery
              proposal.
            </div>
          )}
        </>
      )}
      {tab === "plan" &&
        (plan ? (
          <>
            <div className={"plan-banner " + (verified ? "is-verified" : "")}>
              <span className="plan-symbol">
                {verified ? <ShieldCheck size={30} /> : <Package size={30} />}
              </span>
              <div>
                <div className="eyebrow">
                  {verified ? "APPLIED AND READ BACK" : "PROPOSED RECOVERY"}
                </div>
                <h2>
                  {plan.completeOrders} of {plan.totalAffected} affected orders
                  projected on time.
                </h2>
                <p>
                  {plan.remainingShortage
                    ? `${plan.remainingShortage} units remain uncovered. Incomplete orders are not counted as on-time shipments.`
                    : "Quantities, dates and budget satisfy the recorded planning constraints."}
                </p>
              </div>
            </div>
            {stale && (
              <div className="error">
                Source data changed after this proposal. Return to Impact and
                recalculate before approving.
              </div>
            )}
            <div className="plan-layout">
              <section className="panel">
                <div className="section-head">
                  <h2>Allocation schedule</h2>
                  <span className="mono">
                    {plan.id.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>On hand</th>
                        <th>Expected</th>
                        <th>Uncovered</th>
                        <th>Outcome</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plan.allocations.map((a) => (
                        <tr key={a.orderId}>
                          <td className="mono">{a.orderId}</td>
                          <td className="mono">{a.stockQuantity}</td>
                          <td className="mono">
                            {Object.values(a.offerQuantities).reduce(
                              (n, q) => n + q,
                              0,
                            )}
                          </td>
                          <td className="mono">{a.shortage}</td>
                          <td>
                            <Badge tone={a.complete ? "green" : "amber"}>
                              {a.complete ? "Day " + a.projectedDay : "At risk"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="plan-assumptions">
                  <Clock3 size={17} />
                  <p>
                    Projected delivery includes recorded arrival, assembly and
                    delivery time. Complete shipments only; expected supply has
                    not been received.
                  </p>
                </div>
              </section>
              <aside className="cost-panel">
                <div className="eyebrow">COST OF RECOVERY</div>
                <div className="cost-main">
                  {money(plan.premiumCents)}
                  <span>additional component cost</span>
                </div>
                <div className="cost-line">
                  <span>Additional cost limit</span>
                  <strong>{money(s.premiumCapCents)}</strong>
                </div>
                <div className="cost-line">
                  <span>Draft purchase value</span>
                  <strong>{money(plan.purchaseCents)}</strong>
                </div>
                <div className="cost-line">
                  <span>On-hand allocation</span>
                  <strong>{plan.stockUsed} units</strong>
                </div>
                <div className="cost-line">
                  <span>Expected supply allocation</span>
                  <strong>
                    {Object.values(plan.purchased).reduce((n, q) => n + q, 0)}{" "}
                    units
                  </strong>
                </div>
                <hr />
                {verified ? (
                  <div className="verified-receipt">
                    <ShieldCheck size={20} />
                    <strong>Plan verified</strong>
                    <span className="mono">{plan.requisitionId}</span>
                    <p>
                      Internal allocations saved. Purchase requisition remains a
                      draft.
                    </p>
                    <Button
                      kind="quiet"
                      onClick={() => download("recovery-receipt.json", plan)}
                    >
                      <Download size={15} />
                      Download receipt
                    </Button>
                  </div>
                ) : (
                  <>
                    <Button
                      onClick={() => setConfirm(true)}
                      disabled={busy || stale || plan.completeOrders === 0}
                    >
                      {busy ? (
                        <LoaderCircle className="spin" size={16} />
                      ) : (
                        <Check size={17} />
                      )}
                      Approve recovery plan
                    </Button>
                    <p className="fine-print">
                      Creates internal allocations and a draft requisition. It
                      does not purchase or externally reserve stock.
                    </p>
                  </>
                )}
              </aside>
            </div>
            <div className="context-note">
              <ShieldCheck size={17} />
              <span>
                {plan.exhausted
                  ? "Supported allocation search completed."
                  : "A bounded feasible plan was found; the search limit was reached. Global optimality is not claimed."}
              </span>
              <button
                className="text-button"
                onClick={() => inspect(plan.evidenceIds)}
              >
                Review sources <ArrowUpRight size={14} />
              </button>
            </div>
            {verified && (
              <section className="next-scenario">
                <div>
                  <h3>What if the available quantity changes?</h3>
                  <p>
                    Create a fresh scenario with a smaller quote and see what
                    remains recoverable.
                  </p>
                </div>
                <Link className="button quiet" to="/app/data">
                  Explore the source data <ArrowRight size={16} />
                </Link>
              </section>
            )}
          </>
        ) : (
          <div className="empty-state">
            <Package size={30} />
            <h2>A plan starts with the evidence.</h2>
            <p>
              Run the investigation from Impact to generate a recovery proposal.
            </p>
            <Button onClick={() => setTab("impact")}>
              Go to Impact <ArrowRight size={16} />
            </Button>
          </div>
        ))}
      {tab === "activity" && (
        <>
          <div className="section-head">
            <div>
              <h2>The decision trail.</h2>
              <p>
                Actual MCP operations and their returned results, recorded in
                this workspace.
              </p>
            </div>
            <Button kind="quiet" onClick={() => reload()}>
              <RefreshCw size={15} />
              Refresh
            </Button>
          </div>
          {state!.activity.length ? (
            state!.activity.map((a, i) => (
              <article className="activity-item" key={i}>
                <span className={"activity-dot " + (a.error ? "failed" : "")}>
                  <Check size={13} />
                </span>
                <div>
                  <strong>{toolsLabel[a.tool] || a.tool}</strong>
                  <small>
                    {new Date(a.at).toLocaleTimeString()} / {a.durationMs} ms
                  </small>
                  <details>
                    <summary>
                      Inspect technical trace <ChevronRight size={13} />
                    </summary>
                    <div className="trace-name mono">{a.tool}</div>
                    <pre>
                      {JSON.stringify(
                        { input: a.input, output: a.output },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                </div>
              </article>
            ))
          ) : (
            <div className="notice">
              No investigation has run in this workspace yet.
            </div>
          )}
        </>
      )}
      {confirm && (
        <div className="modal-backdrop">
          <section
            className="modal"
            ref={focus}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Approve recovery plan"
          >
            <header>
              <div>
                <div className="eyebrow">CONFIRM INTERNAL CHANGES</div>
                <h2>Apply this recovery plan?</h2>
              </div>
              <button
                className="icon-button"
                aria-label="Cancel approval"
                onClick={() => setConfirm(false)}
              >
                <X />
              </button>
            </header>
            <p>
              Allocate {plan?.stockUsed} on-hand units and{" "}
              {Object.values(plan?.purchased || {}).reduce((n, q) => n + q, 0)}{" "}
              expected units. Create a {money(plan?.purchaseCents || 0)} draft
              requisition, with {money(plan?.premiumCents || 0)} additional
              cost.
            </p>
            <div className="notice">
              Your approval is bound to this plan and the current source
              revision. Supplier purchases and delivery are outside this action.
            </div>
            <footer>
              <Button kind="quiet" onClick={() => setConfirm(false)}>
                Cancel
              </Button>
              <Button onClick={approve}>
                Approve and verify <ArrowRight size={16} />
              </Button>
            </footer>
          </section>
        </div>
      )}
    </main>
  );
}
