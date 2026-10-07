import { signOut } from "../actions";
import { Nav } from "@/components/Nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="shell">
      <aside>
        <div className="brand">Prosperity Planner</div>
        <Nav />
        <form action={signOut}><button type="submit" className="link">Sign out</button></form>
      </aside>
      <main>{children}</main>
    </div>
  );
}
