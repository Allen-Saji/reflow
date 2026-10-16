import { useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  ArrowRight,
  ArrowUpRight,
  AlertTriangle,
  Network,
  Layers,
  LoaderCircle,
} from "lucide-react";
import { api } from "./api";

import { Logo, Button } from "./ui";

export function Landing() {
  const nav = useNavigate(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function open() {
    setBusy(true);
    try {
      await api("/workspaces", { variant: "base" });
      nav("/app");
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="landing">
      <header className="landing-nav">
        <Logo />
        <span className="mono subtle">CONNECTED SUPPLY / CLEAR DECISIONS</span>
        <Button onClick={open} disabled={busy} kind="quiet">
          Open workspace <ArrowUpRight size={16} />
        </Button>
      </header>
      <main className="landing-main">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="small-rule" /> OPERATIONS, BACK IN MOTION
          </div>
          <h1>
            A supplier stops.
            <br />
            Your orders
            <br />
            <em>don't have to.</em>
          </h1>
          <p className="hero-description">
            Follow the disruption. Find the right alternative. Put a recovery
            plan into motion, with the evidence behind every decision.
          </p>
          <Button onClick={open} disabled={busy}>
            {busy ? <LoaderCircle className="spin" size={18} /> : null}
            {busy ? "Preparing your workspace" : "Open the sample workspace"}
            <ArrowRight size={18} />
          </Button>
          <p className="sample-note">
            Fictional manufacturer. Real graph queries and saved actions.
            <br />
            Your workspace is isolated from other visitors.
          </p>
          {error && (
            <div role="alert" className="error">
              {error}
            </div>
          )}
        </div>
        <div className="hero-board">
          <div className="board-top">
            <span className="mono">THE CONNECTION IS THE CLUE</span>
            <Network size={18} />
          </div>
          <div className="board-node factory">
            <span className="node-symbol">
              <Layers size={20} />
            </span>
            <div>
              <span className="mono">UPSTREAM FACTORY</span>
              <strong>One shared dependency.</strong>
            </div>
            <span className="red-dot" />
          </div>
          <div className="branch">
            <span />
            <span />
          </div>
          <div className="supplier-pair">
            <div className="mini-node">
              <span className="mono">SUPPLIER A</span>
              <strong>Primary source</strong>
            </div>
            <div className="mini-node">
              <span className="mono">SUPPLIER B</span>
              <strong>Apparent alternative</strong>
            </div>
          </div>
          <div className="board-callout">
            <AlertTriangle size={18} />
            <p>
              Different supplier.
              <br />
              <strong>Same disrupted factory.</strong>
            </p>
          </div>
          <div className="board-bottom">
            <span>Look beyond the first connection.</span>
            <ArrowUpRight size={20} />
          </div>
        </div>
      </main>
      <div className="landing-bottom">
        <div>
          <span className="index">01</span>
          <strong>Trace the impact</strong>
          <p>From factory to customer order.</p>
        </div>
        <div>
          <span className="index">02</span>
          <strong>Compare the evidence</strong>
          <p>Compatible, available, and on time.</p>
        </div>
        <div>
          <span className="index">03</span>
          <strong>Verify the recovery</strong>
          <p>Approved allocations. A saved result.</p>
        </div>
      </div>
      <footer className="landing-footer">
        <span>Built on connected facts.</span>
        <span className="mono">POWERED BY FALKORDB</span>
      </footer>
    </div>
  );
}
