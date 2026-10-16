import { useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowUpRight,
  FileText,
  Plus,
  LoaderCircle,
  Download,
  Upload,
} from "lucide-react";
import { api, download } from "./api";
import { Source } from "../domain/model";
import { Context } from "./context";
import { Button, PageHead, OrdersTable } from "./ui";

export function DataPage() {
  const { state, reload, inspect, setError } = useContext(Context),
    nav = useNavigate(),
    [busy, setBusy] = useState(false),
    [recordTab, setRecordTab] = useState("offers");
  const s = state!.snapshot;
  async function fresh(variant: "base" | "shortage") {
    setBusy(true);
    try {
      await api("/workspaces", { variant });
      await reload();
      nav("/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const exportFixture = () => {
    const {
      version,
      disruption,
      stockReserved,
      offerAllocated,
      caseId,
      ...fixture
    } = s;
    download("northline-supply-data.json", fixture);
  };
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 150000) {
      setError("Dataset exceeds the 150 KB import limit.");
      return;
    }
    setBusy(true);
    try {
      const fixture = JSON.parse(await file.text());
      await api("/workspaces", { fixture });
      await reload();
      nav("/app");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page">
      <PageHead
        eyebrow="SOURCE RECORDS"
        title="The facts behind the plan."
        description="Inspect the recorded supply network. Changes here affect the next investigation."
        action={
          <Button kind="quiet" onClick={exportFixture}>
            <Download size={16} />
            Download dataset
          </Button>
        }
      />
      <section className="scenario-panel">
        <div>
          <div className="eyebrow">EXPLORE A DIFFERENT OUTCOME</div>
          <h2>Same disruption. Less available supply.</h2>
          <p>
            Open a fresh baseline with Delta's quote reduced to 50 units.
            Previous scenarios and allocations stay separate.
          </p>
        </div>
        <Button disabled={busy} onClick={() => fresh("shortage")}>
          {busy ? (
            <LoaderCircle className="spin" size={16} />
          ) : (
            <Plus size={16} />
          )}
          Open 50-unit scenario
        </Button>
      </section>
      <div className="case-tabs" role="tablist" aria-label="Data categories">
        {["offers", "products", "sources"].map((t) => (
          <button
            role="tab"
            aria-selected={recordTab === t}
            className={recordTab === t ? "active" : ""}
            key={t}
            onClick={() => setRecordTab(t)}
          >
            {t === "offers"
              ? "Supplier offers"
              : t === "products"
                ? "Products & orders"
                : "Source evidence"}
          </button>
        ))}
      </div>
      {recordTab === "offers" && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Component</th>
                <th>Quoted quantity</th>
                <th>Arrival</th>
                <th>Source</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {s.offers.map((o) => (
                <tr key={o.id}>
                  <td>
                    <strong>
                      {s.suppliers.find((x) => x.id === o.supplierId)?.name}
                    </strong>
                    <small>
                      {s.factories.find((x) => x.id === o.factoryId)?.name ||
                        "Unknown upstream"}
                    </small>
                  </td>
                  <td className="mono">{o.partId}</td>
                  <td>
                    <OfferEditor
                      id={o.id}
                      quantity={o.quantity}
                      revision={s.version}
                    />
                  </td>
                  <td className="mono">Day {o.arrivalDay}</td>
                  <td className="mono">{o.sourceId}</td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => inspect([o.sourceId])}
                    >
                      Inspect <ArrowUpRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {recordTab === "products" && (
        <>
          <section className="panel">
            <div className="section-head">
              <h2>Product requirements</h2>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Critical component</th>
                    <th>Required voltage</th>
                    <th>Assembly / delivery</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {s.products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.name}</td>
                      <td className="mono">{p.partId}</td>
                      <td>{p.requiredVoltage}V</td>
                      <td>
                        {p.assemblyDays} / {p.deliveryDays} days
                      </td>
                      <td>
                        <button
                          className="text-button"
                          onClick={() => inspect([p.sourceId])}
                        >
                          Specification <ArrowUpRight size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="panel">
            <div className="section-head">
              <h2>Customer order schedule</h2>
            </div>
            <OrdersTable />
          </section>
        </>
      )}
      {recordTab === "sources" && (
        <div className="source-grid">
          {s.sources.map((source) => (
            <button
              className="source-tile"
              key={source.id}
              onClick={() => inspect([source.id])}
            >
              <FileText size={20} />
              <span className="mono">{source.kind}</span>
              <h3>{source.title}</h3>
              <p>{source.detail}</p>
              <span className="text-button">
                Inspect record <ArrowUpRight size={15} />
              </span>
            </button>
          ))}
        </div>
      )}
      <section className="import-panel">
        <div>
          <h3>Bring a small, structured dataset.</h3>
          <p>
            Use the downloaded JSON as a schema example. Imports support up to
            three orders, four offers and 250 ordered units. Use public or
            synthetic data you are allowed to share. Autonomous investigations
            send these records to the configured model provider.
          </p>
        </div>
        <label className="button quiet">
          <Upload size={16} />
          Import JSON
          <input
            type="file"
            accept="application/json,.json"
            hidden
            disabled={busy}
            onChange={(e) => upload(e.target.files?.[0])}
          />
        </label>
        <Button kind="quiet" disabled={busy} onClick={() => fresh("base")}>
          <Plus size={16} />
          Fresh base scenario
        </Button>
      </section>
    </main>
  );
}
export function OfferEditor({
  id,
  quantity,
  revision,
}: {
  id: string;
  quantity: number;
  revision: number;
}) {
  const { reload, setError } = useContext(Context),
    [value, setValue] = useState(quantity),
    [busy, setBusy] = useState(false);
  useEffect(() => setValue(quantity), [quantity, revision]);
  async function save() {
    setBusy(true);
    try {
      await api("/offers/" + id, { quantity: value });
      await reload();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="inline-editor">
      <input
        aria-label={"Quoted quantity for " + id}
        type="number"
        min="0"
        max="1000"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
      {value !== quantity && (
        <button className="text-button" disabled={busy} onClick={save}>
          Save
        </button>
      )}
    </div>
  );
}
