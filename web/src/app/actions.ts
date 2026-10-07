"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (error) redirect("/login?error=1");
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// GitHub Actions workflow file -> agent name it logs in agent_runs.
const SYNCS ={ "buxfer-sync.yml": "buxfer_sync", "sharesight-sync.yml": "sharesight_sync" } as const;

export type SyncRun = { agent: string; status: "running" | "succeeded" | "failed"; error: string | null };

/** Starts both sync workflows now. Returns when they were requested, to poll syncStatus with. */
export async function refreshData(): Promise<{ since: string } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Not signed in" };
  const token = process.env.GITHUB_TOKEN;
  if (!token) return { error: "GITHUB_TOKEN is not set on the server" };
  const repo = process.env.GITHUB_REPO ?? "josekochferreira/prosperityplanner";

  const since = new Date().toISOString();
  const responses = await Promise.all(
    Object.keys(SYNCS).map((workflow) =>
      fetch(`https://api.github.com/repos/${repo}/actions/workflows/${workflow}/dispatches`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        body: JSON.stringify({ ref: "main" }),
        cache: "no-store",
      }),
    ),
  );
  const failed = responses.find((r) => !r.ok);
  if (failed) return { error: `GitHub refused the request (${failed.status})` };
  return { since };
}

/** Latest run of each sync agent started after `since` (RLS limits it to the signed-in owner). */
export async function syncStatus(since: string): Promise<SyncRun[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("agent_runs")
    .select("agent, status, error")
    .in("agent", Object.values(SYNCS))
    .gte("started_at", since)
    .order("started_at", { ascending: false });
  if (error) throw new Error(error.message);
  const latest = new Map<string, SyncRun>();
  for (const run of data as SyncRun[]) if (!latest.has(run.agent)) latest.set(run.agent, run);
  return [...latest.values()];
}
