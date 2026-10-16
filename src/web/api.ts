import type { Snapshot, Impact, Candidate, Plan } from "../domain/model";
export type AppState = {
  id: string;
  snapshot: Snapshot;
  impact: Impact | null;
  candidates: Candidate[];
  plans: Plan[];
  activity: {
    at: string;
    tool: string;
    input: unknown;
    output: unknown;
    durationMs: number;
    error?: string;
  }[];
  agentAvailable: boolean;
};
export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const r = await fetch("/api" + path, {
    method: body === undefined ? "GET" : "POST",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "Request failed.");
  return data;
}
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
export function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
