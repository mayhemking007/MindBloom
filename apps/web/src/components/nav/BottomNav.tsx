import {
  CalendarDays,
  LogIn,
  LogOut,
  PencilLine,
  Settings,
  StickyNote,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";

const navItems = [
  { to: "/", label: "Today", icon: PencilLine },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
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
    <nav className="fixed bottom-0 left-0 z-30 h-[60px] w-full border-t border-bloom-border bg-bloom-surface px-3 md:sticky md:top-0 md:flex md:h-14 md:items-center md:border-b md:border-t-0 md:px-5">
      <div className="hidden min-w-[210px] items-baseline gap-3 md:flex">
        <p className="font-serif text-[22px] text-bloom-text-primary">MindBloom</p>
      </div>

      <div className="grid h-full grid-cols-5 items-center gap-1 md:flex md:h-auto md:flex-1 md:items-center md:justify-center md:gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium transition-colors md:h-9 md:flex-row md:gap-2 md:px-3 md:text-[13px]",
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
            className="flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium text-bloom-text-tertiary transition-colors hover:text-bloom-text-secondary md:hidden"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            <span>{isLoggingOut ? "Logging out" : "Logout"}</span>
          </button>
        ) : (
          <NavLink
            to="/login"
            className={({ isActive }) =>
              [
                "flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium transition-colors md:hidden",
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

      <div className="hidden min-w-0 items-center justify-end gap-3 md:flex">
        {isLoading ? (
          <p className="text-[12px] text-bloom-text-secondary">Checking...</p>
        ) : user ? (
          <>
            <div className="min-w-0 text-right">
              <p className="max-w-[180px] truncate text-[13px] font-medium text-bloom-text-primary">
                {user.displayName || user.email}
              </p>
              <p className="max-w-[180px] truncate text-[11px] text-bloom-text-tertiary">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={isLoggingOut}
              className="flex h-9 items-center gap-2 rounded-bloom-sm border border-bloom-border bg-bloom-bg px-3 text-[12px] font-medium text-bloom-text-secondary transition-colors hover:text-bloom-text-primary disabled:cursor-not-allowed disabled:opacity-50"
            >
              <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              <span>{isLoggingOut ? "Logging out" : "Logout"}</span>
            </button>
          </>
        ) : (
          <>
            <p className="text-[12px] text-bloom-text-secondary">
              Demo mode{ownerKind === "demo" ? " - one temporary entry" : ""}
            </p>
            <NavLink
              to="/login"
              className={({ isActive }) =>
                [
                  "flex h-9 items-center gap-2 rounded-bloom-sm border border-bloom-border px-3 text-[12px] font-medium transition-colors",
                  isActive
                    ? "bg-bloom-accent-bg text-bloom-accent"
                    : "bg-bloom-bg text-bloom-text-secondary hover:text-bloom-text-primary",
                ].join(" ")
              }
            >
              <LogIn aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
              <span>Login</span>
            </NavLink>
          </>
        )}
      </div>
    </nav>
  );
}
