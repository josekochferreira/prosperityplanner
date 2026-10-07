import { signOut } from "../actions";
import { Nav } from "@/components/Nav";
import { RefreshButton } from "@/components/RefreshButton";
import { fetchLastSync } from "@/lib/data";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const lastSync = await fetchLastSync();
  return (
    <div className="shell">
      <aside>
        <div className="brand">Prosperity Planner</div>
        <Nav />
        <RefreshButton lastUpdated={lastSync} />
        <form action={signOut}><button type="submit" className="link">Sign out</button></form>
      </aside>
      <main>{children}</main>
    </div>
  );
}
