import { Flower2, LogOut, Moon, Sun } from "lucide-react";
import { Link, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../../web/src/auth/AuthContext";
import { useTheme } from "../../../web/src/theme/ThemeContext";

export function NotionBloomLayout() {
  const { logout, user } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  async function signOut() {
    await logout();
    navigate("/");
  }

  return <div className="min-h-dvh bg-bloom-bg text-bloom-text-primary">
    <header className="sticky top-0 z-20 border-b border-bloom-border bg-bloom-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-4 md:px-8">
        <Link to="/notion" className="flex items-center gap-2.5 font-serif text-[20px]"><span className="grid h-9 w-9 place-items-center rounded-full bg-bloom-accent text-bloom-on-accent"><Flower2 className="h-4 w-4" /></span>Notion Bloom</Link>
        <div className="flex items-center gap-2"><span className="hidden text-[11px] text-bloom-text-tertiary sm:block">{user?.email}</span><button type="button" onClick={toggleTheme} aria-label="Toggle theme" className="grid h-9 w-9 place-items-center rounded-full border border-bloom-border bg-bloom-surface">{resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}</button><button type="button" onClick={() => void signOut()} className="flex h-9 items-center gap-1.5 rounded-full border border-bloom-border bg-bloom-surface px-3 text-[11px]"><LogOut className="h-3.5 w-3.5" />Sign out</button></div>
      </div>
    </header>
    <Outlet />
  </div>;
}
