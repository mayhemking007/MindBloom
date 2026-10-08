import { Flower2 } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../../../web/src/auth/AuthContext";

export function NotionBloomAuthPage({ mode }: { mode: "login" | "register" }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState(mode === "login" ? "writer@mindbloom.local" : "");
  const [password, setPassword] = useState(mode === "login" ? "password123" : "");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true); setError(null);
    try {
      if (mode === "login") await login(email, password);
      else await register(email, password, displayName);
      navigate("/notion");
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Notion Bloom could not sign you in.");
    } finally { setBusy(false); }
  }

  return <main className="grid min-h-dvh place-items-center bg-bloom-bg px-4 py-8"><section className="w-full max-w-[430px] rounded-bloom border border-bloom-border bg-bloom-surface p-6 shadow-sm"><Link to="/" className="inline-flex items-center gap-2 font-serif text-[18px]"><span className="grid h-9 w-9 place-items-center rounded-full bg-bloom-accent text-bloom-on-accent"><Flower2 className="h-4 w-4" /></span>Notion Bloom</Link><h1 className="mt-7 font-serif text-[32px]">{mode === "login" ? "Welcome back" : "Create your garden"}</h1><p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">{mode === "login" ? "Sign in to continue to your Notion garden." : "Create an account for your private Notion knowledge garden."}</p><div className="mt-6 space-y-4">{mode === "register" ? <label className="block text-[12px] font-medium text-bloom-text-secondary">Display name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="mt-2 h-11 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none" /></label> : null}<label className="block text-[12px] font-medium text-bloom-text-secondary">Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" className="mt-2 h-11 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none" /></label><label className="block text-[12px] font-medium text-bloom-text-secondary">Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-2 h-11 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none" /></label></div>{error ? <p role="alert" className="mt-4 text-[13px] text-coral-text">{error}</p> : null}<button type="button" onClick={() => void submit()} disabled={busy} className="mt-5 h-11 w-full rounded-bloom-sm bg-bloom-accent text-[14px] font-medium text-bloom-on-accent disabled:opacity-50">{busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}</button><p className="mt-4 text-[12px] text-bloom-text-secondary">{mode === "login" ? "New here?" : "Already have an account?"} <Link className="text-bloom-accent" to={mode === "login" ? "/register" : "/login"}>{mode === "login" ? "Create account" : "Sign in"}</Link></p></section></main>;
}
