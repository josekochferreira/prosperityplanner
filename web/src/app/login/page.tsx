import { signIn } from "../actions";

export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <main className="login">
      <h1>Prosperity Planner</h1>
      <form action={signIn}>
        <label>Email<input name="email" type="email" autoComplete="email" required /></label>
        <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
        {error && <p role="alert" className="error">Sign-in failed. Check your email and password.</p>}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
