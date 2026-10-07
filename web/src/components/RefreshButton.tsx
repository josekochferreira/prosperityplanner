"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { refreshData, syncStatus } from "@/app/actions";

const POLL_MS = 5000;
const GIVE_UP_MS = 10 * 60 * 1000; // GitHub runners can queue for a while
const EXPECTED = 2; // Buxfer + Sharesight

type State =
  | { kind: "idle" }
  | { kind: "running"; since: string; done: number }
  | { kind: "error"; message: string };

/** Starts both data syncs and reloads the page's data once they have finished. */
export function RefreshButton({ lastUpdated }: { lastUpdated: string | null }) {
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "idle" });

  useEffect(() => {
    if (state.kind !== "running") return;
    const startedAt = Date.parse(state.since);
    const timer = setInterval(async () => {
      try {
        const runs = await syncStatus(state.since);
        const failed = runs.find((r) => r.status === "failed");
        const done = runs.filter((r) => r.status !== "running").length;
        if (failed) {
          setState({ kind: "error", message: `${label(failed.agent)} sync failed` });
          router.refresh();
        } else if (done >= EXPECTED) {
          setState({ kind: "idle" });
          router.refresh();
        } else if (Date.now() - startedAt > GIVE_UP_MS) {
          setState({ kind: "error", message: "Still running after 10 min; check GitHub Actions" });
        } else if (done !== state.done) {
          setState({ ...state, done });
        }
      } catch {
        // Transient network error; try again on the next tick.
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [state, router]);

  async function start() {
    setState({ kind: "running", since: new Date().toISOString(), done: 0 });
    const result = await refreshData();
    setState("error" in result
      ? { kind: "error", message: result.error }
      : { kind: "running", since: result.since, done: 0 });
  }

  const running = state.kind === "running";
  return (
    <div className="refresh">
      <button type="button" onClick={start} disabled={running}>
        {running ? "Updating…" : "Update data"}
      </button>
      <small role="status" suppressHydrationWarning>
        {running
          ? `${state.done} of ${EXPECTED} syncs done. Takes about a minute.`
          : state.kind === "error"
            ? <span className="error">{state.message}</span>
            : lastUpdated
              ? `Last updated ${formatWhen(lastUpdated)}`
              : "Not synced yet"}
      </small>
    </div>
  );
}

const label = (agent: string) => (agent.startsWith("buxfer") ? "Buxfer" : "Sharesight");

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}
