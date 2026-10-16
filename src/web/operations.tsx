import React, { useContext, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  Network,
  FileText,
  Plus,
  X,
  LoaderCircle,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { useReveal } from "./motion";
import { api } from "./api";

import { Context } from "./context";
import { Button, PageHead, OrdersTable, useModalFocus } from "./ui";

export function Operations() {
  const reveal = useReveal<HTMLElement>();
  const { state, reload, inspect, setError } = useContext(Context),
    [modal, setModal] = useState(false);
  const s = state!.snapshot;
  const verified = state!.plans.some((p) => p.status === "verified");
  return (
    <main className="page" ref={reveal}>
      <PageHead
        eyebrow="OPERATIONS"
        title="Order overview"
        description="Track orders, available stock, and supply problems."
        action={
          !s.disruption ? (
            <Button onClick={() => setModal(true)}>
              <Plus size={17} />
              Report disruption
            </Button>
          ) : (
            <Link className="button" to={"/app/cases/" + s.caseId}>
              Open recovery case <ArrowRight size={17} />
            </Link>
          )
        }
      />
      <div className="metrics">
        <div>
          <span>Customer orders</span>
          <strong>{s.orders.length.toString().padStart(2, "0")}</strong>
          <small>In this scenario</small>
        </div>
        <div>
          <span>{verified ? "Projected on time" : "Orders affected"}</span>
          <strong className={state!.impact ? "risk-number" : ""}>
            {(verified
              ? state!.plans.find((p) => p.status === "verified")!
                  .completeOrders
              : state!.impact?.orderIds.length || 0
            )
              .toString()
              .padStart(2, "0")}
          </strong>
          <small>
            {verified
              ? "Based on the saved recovery plan"
              : s.disruption
                ? "Need a recovery plan"
                : "No supply problems reported"}
          </small>
        </div>
        <div>
          <span>Available stock</span>
          <strong>
            {s.stock.quantity - s.stockReserved}
            <em> units</em>
          </strong>
          <small>In stock now; incoming supply excluded</small>
        </div>
      </div>
      {s.disruption ? (
        <Link
          className={"incident-banner " + (verified ? "verified-banner" : "")}
          to={"/app/cases/" + s.caseId}
        >
          <span className="incident-icon">
            {verified ? <ShieldCheck /> : <AlertTriangle />}
          </span>
          <div>
            <span className="eyebrow">
              {verified ? "RECOVERY PLAN VERIFIED" : "SUPPLY DISRUPTION"}
            </span>
            <h2>
              {verified
                ? "Recovery plan saved"
                : (s.factories.find((f) => f.id === s.disruption!.factoryId)
                    ?.name || "Recorded factory") +
                  " is unavailable through Day " +
                  s.disruption.untilDay +
                  "."}
            </h2>
            <p>
              {verified
                ? "Stock is allocated and a purchase request is drafted. Replacement supply has not arrived yet."
                : "See which orders are affected and compare replacement suppliers."}
            </p>
          </div>
          <ArrowRight />
        </Link>
      ) : (
        <section className="welcome-panel">
          <div className="line-icon">
            <Network size={32} />
          </div>
          <div>
            <h2>Report a supply problem</h2>
            <p>
              Choose the affected factory to see which customer orders need a
              recovery plan.
            </p>
            <button className="text-button" onClick={() => setModal(true)}>
              Report a disruption <ArrowRight size={16} />
            </button>
          </div>
          <span className="mono section-index">01 / INVESTIGATE</span>
        </section>
      )}
      <section className="panel">
        <div className="section-head">
          <div>
            <h2>Customer orders</h2>
            <p>Order status based on the current supply plan.</p>
          </div>
          <button
            className="text-button"
            onClick={() =>
              inspect([...s.orders.map((o) => o.sourceId), s.stock.sourceId])
            }
          >
            View schedule <ArrowUpRight size={15} />
          </button>
        </div>
        <OrdersTable />
      </section>
      <div className="context-note">
        <FileText size={16} />
        <span>
          This workspace uses{" "}
          {s.datasetKind === "public" ? "public" : "synthetic"} data. Plans
          create internal allocations and draft requisitions.
        </span>
        <Link to="/app/data">
          View source data <ArrowRight size={14} />
        </Link>
      </div>
      {modal && <DisruptionModal onClose={() => setModal(false)} />}
    </main>
  );
}
export function DisruptionModal({ onClose }: { onClose: () => void }) {
  const { state, reload, setError } = useContext(Context),
    nav = useNavigate(),
    [busy, setBusy] = useState(false),
    [factory, setFactory] = useState(state!.snapshot.factories[0].id),
    [until, setUntil] = useState(8),
    [cap, setCap] = useState(200),
    [source, setSource] = useState(
      state!.snapshot.sources.find((x) => x.kind === "notice")?.id ||
        state!.snapshot.sources[0].id,
    );
  const focus = useModalFocus(true, onClose);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const c = await api("/cases", {
        factoryId: factory,
        untilDay: until,
        premiumCapCents: Math.round(cap * 100),
        sourceId: source,
      });
      await reload();
      nav("/app/cases/" + c.id);
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div
      className="modal-backdrop"
      ref={focus}
      role="dialog"
      aria-modal="true"
      aria-label="Report a supply disruption"
      tabIndex={-1}
    >
      <form className="modal" onSubmit={submit}>
        <header>
          <div>
            <div className="eyebrow">START A RECOVERY CASE</div>
            <h2>What changed?</h2>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close disruption form"
          >
            <X />
          </button>
        </header>
        <p>
          Choose the affected factory, how long it is unavailable, and your
          extra cost limit.
        </p>
        <label>
          Affected factory
          <select value={factory} onChange={(e) => setFactory(e.target.value)}>
            {state!.snapshot.factories.map((f) => (
              <option value={f.id} key={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label>
            Unavailable through day
            <input
              type="number"
              min="0"
              max="365"
              value={until}
              onChange={(e) => setUntil(Number(e.target.value))}
            />
          </label>
          <label>
            Additional cost limit (USD)
            <input
              type="number"
              min="0"
              max="10000"
              step="0.01"
              value={cap}
              onChange={(e) => setCap(Number(e.target.value))}
            />
          </label>
        </div>
        <label>
          Supporting source
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            {state!.snapshot.sources.map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </label>
        <div className="notice">
          <Clock3 size={16} />
          Day numbers are relative to this planning scenario.
        </div>
        <footer>
          <Button kind="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={16} /> : null}Create
            recovery case <ArrowRight size={16} />
          </Button>
        </footer>
      </form>
    </div>
  );
}
