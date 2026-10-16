import React, { useEffect, useState, useCallback } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  NavLink,
  useNavigate,
} from "react-router-dom";

import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  Network,
  FileText,
  Layers,
  X,
  LoaderCircle,
  ChevronRight,
} from "lucide-react";
import { api, type AppState } from "./api";

import { createRoot } from "react-dom/client";
import { Context } from "./context";
import { Logo, Badge, EvidenceDrawer } from "./ui";
import { Landing } from "./landing";
import { Operations } from "./operations";
import { RecoveryCase } from "./case";
import { DataPage } from "./data";
import "@fontsource/inter/latin-300.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/inter/latin-700.css";
import "@fontsource/playfair-display/latin-400-italic.css";
import "./style.css";
function Shell() {
  const [state, setState] = useState<AppState | null>(null),
    [error, setError] = useState(""),
    [evidence, setEvidence] = useState<string[] | null>(null),
    [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const nav = useNavigate();
  const reload = useCallback(async () => {
    const s = await api<AppState>("/state");
    setState(s);
    setWorkspaces(await api("/workspaces"));
  }, []);
  useEffect(() => {
    reload().catch((e) => setError(e.message));
  }, [reload]);
  return (
    <Context.Provider
      value={{ state, reload, inspect: setEvidence, error, setError }}
    >
      <div className="app-shell bg-dots">
        <aside className="sidebar">
          <Logo small />
          <div className="workspace-caption">OPERATIONS WORKSPACE</div>
          <div className="company">
            <span className="company-icon">
              {state?.snapshot.name.charAt(0) || "S"}.
            </span>
            <div>
              <strong>{state?.snapshot.name || "Your workspace"}</strong>
              <small>Manufacturing operations</small>
            </div>
          </div>
          <nav>
            <NavLink end to="/app">
              <Layers size={18} />
              Operations
            </NavLink>
            <NavLink to="/app/data">
              <FileText size={18} />
              Data & evidence
            </NavLink>
          </nav>
          <div className="sidebar-bottom">
            <span className="powered">
              <Network size={15} />
              FalkorDB connected facts
            </span>
            <p>
              Plans stay inspectable.
              <br />
              Actions stay accountable.
            </p>
            <Link to="/">
              About Reflow <ArrowUpRight size={13} />
            </Link>
          </div>
        </aside>
        <div className="app-body">
          <header className="app-top">
            <span className="breadcrumbs">
              Workspace <ChevronRight size={14} />
              <strong>{state?.snapshot.name || "Loading"}</strong>
            </span>
            <div className="top-actions">
              {workspaces.length > 1 && (
                <select
                  aria-label="Switch scenario"
                  value={state?.id || ""}
                  onChange={async (e) => {
                    await api("/workspaces/" + e.target.value + "/select", {});
                    await reload();
                    nav("/app");
                  }}
                >
                  {workspaces.map((w, i) => (
                    <option key={w.id} value={w.id}>
                      Scenario {i + 1} /{" "}
                      {w.id === state?.id
                        ? state.snapshot.offers.reduce(
                            (n, x) => n + x.quantity,
                            0,
                          ) + " units across offers"
                        : w.name}
                    </option>
                  ))}
                </select>
              )}
              <Badge>
                {state?.snapshot.datasetKind === "public"
                  ? "Public dataset"
                  : "Synthetic data"}
              </Badge>
              <span className="avatar">
                {state?.snapshot.name.slice(0, 2).toUpperCase() || "RF"}
              </span>
            </div>
          </header>
          {error && (
            <div className="error global-error" role="alert">
              <AlertTriangle size={16} />
              <span>{error}</span>
              <button aria-label="Dismiss error" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {state ? (
            <Routes>
              <Route index element={<Operations />} />
              <Route path="cases/:id" element={<RecoveryCase />} />
              <Route path="data" element={<DataPage />} />
              <Route path="*" element={<Operations />} />
            </Routes>
          ) : (
            <div className="empty-state">
              <LoaderCircle className="spin" />
              <h2>
                {error ? "Workspace unavailable" : "Opening your workspace"}
              </h2>
              {error && (
                <Link className="button" to="/">
                  Open a sample workspace <ArrowRight size={16} />
                </Link>
              )}
            </div>
          )}
        </div>
        {evidence && state && (
          <EvidenceDrawer
            sources={state.snapshot.sources.filter((s) =>
              evidence.includes(s.id),
            )}
            onClose={() => setEvidence(null)}
          />
        )}
      </div>
    </Context.Provider>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<Shell />} />
        <Route path="*" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
