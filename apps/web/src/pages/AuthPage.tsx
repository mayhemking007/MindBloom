import { Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";

interface AuthPageProps {
  mode: "login" | "register";
}

export function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const { login, register } = useAuth();
  const [email, setEmail] = useState(
    mode === "login" ? "writer@mindbloom.local" : "",
  );
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState(
    mode === "login" ? "password123" : "",
  );
  const [isSubmitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(email, password, displayName);
      }
      navigate("/");
    } catch (authError) {
      setError(
        authError instanceof Error
          ? authError.message
          : "MindBloom could not sign you in.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-bloom-bg px-4 py-8">
      <section className="w-full max-w-[430px] rounded-bloom border border-bloom-border bg-bloom-surface p-6 shadow-sm">
        <div className="mb-6">
          <div className="mb-4 grid h-11 w-11 place-items-center rounded-full border border-purple-border bg-purple-bg text-purple-text">
            <Sparkles className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="label-text">MindBloom</p>
          <h1 className="mt-2 font-serif text-[32px] leading-tight">
            {mode === "login" ? "Welcome back" : "Create your space"}
          </h1>
          <p className="mt-2 text-[13px] leading-5 text-bloom-text-secondary">
            {mode === "login"
              ? "Use a seeded local user, or continue as demo."
              : "Create a local account for persistent entries and sharing."}
          </p>
        </div>

        <div className="space-y-4">
          {mode === "register" ? (
            <label className="block text-[12px] font-medium text-bloom-text-secondary">
              Display name
              <input
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                className="mt-2 h-11 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none focus:border-bloom-border-mid"
              />
            </label>
          ) : null}
          <label className="block text-[12px] font-medium text-bloom-text-secondary">
            Email
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-2 h-11 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none focus:border-bloom-border-mid"
            />
          </label>
          <label className="block text-[12px] font-medium text-bloom-text-secondary">
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              className="mt-2 h-11 w-full rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[14px] outline-none focus:border-bloom-border-mid"
            />
          </label>
        </div>

        {mode === "login" ? (
          <div className="mt-4 rounded-bloom-sm border border-blue-border bg-blue-bg p-3 text-[12px] leading-5 text-blue-text">
            Local test users: `writer@mindbloom.local`, `tester@mindbloom.local`,
            or `demo@mindbloom.local`. Password: `password123`.
          </div>
        ) : null}

        {error ? <p className="mt-4 text-[13px] text-coral-text">{error}</p> : null}

        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSubmitting}
          className="mt-5 h-11 w-full rounded-bloom-sm bg-bloom-accent px-4 text-[14px] font-medium text-bloom-on-accent transition-colors hover:bg-bloom-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting
            ? "Please wait"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <div className="mt-4 flex items-center justify-between gap-3 text-[13px]">
          <Link
            to={mode === "login" ? "/register" : "/login"}
            className="text-bloom-accent"
          >
            {mode === "login" ? "Create account" : "Sign in instead"}
          </Link>
          <Link to="/" className="text-bloom-text-secondary">
            Continue as demo
          </Link>
        </div>
      </section>
    </main>
  );
}
