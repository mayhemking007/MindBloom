import {
  CalendarDays,
  LogIn,
  LogOut,
  Network,
  PencilLine,
  Settings,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

const navItems = [
  { to: "/", label: "Today", icon: PencilLine },
  { to: "/map", label: "Map", icon: Network },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/reflect", label: "Reflect", icon: Sparkles },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function BottomNav() {
  const { isLoading, logout, ownerKind, user } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="fixed bottom-0 left-0 z-30 h-[60px] w-full border-t border-bloom-border bg-bloom-surface px-3 md:sticky md:top-0 md:flex md:h-dvh md:w-[220px] md:flex-col md:border-r md:border-t-0 md:px-4 md:py-6">
      <div className="hidden md:block">
        <p className="font-serif text-[25px] text-bloom-text-primary">MindBloom</p>
        <p className="mt-1 text-[11px] text-bloom-text-tertiary">
          A place to notice what stays
        </p>
      </div>
      <div className="grid h-full grid-cols-7 items-center gap-1 md:mt-8 md:block md:h-auto md:space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium transition-colors md:h-10 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-[13px]",
                  isActive
                    ? "bg-bloom-accent-bg text-bloom-accent"
                    : "text-bloom-text-tertiary hover:text-bloom-text-secondary",
                ].join(" ")
              }
            >
              <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
        {user ? (
          <button
            type="button"
            onClick={() => void handleLogout()}
            disabled={isLoggingOut}
            className="flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium text-bloom-text-tertiary transition-colors hover:text-bloom-text-secondary md:h-10 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-[13px]"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            <span>{isLoggingOut ? "Logging out" : "Logout"}</span>
          </button>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              [
                "flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium transition-colors md:h-10 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-[13px]",
                isActive
                  ? "bg-bloom-accent-bg text-bloom-accent"
                  : "text-bloom-text-tertiary hover:text-bloom-text-secondary",
              ].join(" ")
            }
          >
            <LogIn aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            <span>Login</span>
          </NavLink>
        )}
      </div>
      <div className="mt-auto hidden border-t border-bloom-border pt-4 md:block">
        <p className="text-[11px] font-medium uppercase text-bloom-text-tertiary">
          Account
        </p>
        {isLoading ? (
          <p className="mt-2 text-[12px] text-bloom-text-secondary">Checking...</p>
        ) : user ? (
          <div className="mt-2 min-w-0">
            <p className="truncate text-[13px] font-medium text-bloom-text-primary">
              {user.displayName || user.email}
            </p>
            <p className="mt-1 truncate text-[11px] text-bloom-text-tertiary">
              {user.email}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-[12px] leading-5 text-bloom-text-secondary">
            Demo mode
            {ownerKind === "demo" ? " · one temporary entry" : ""}
          </p>
        )}
      </div>
    </nav>
  );
}
