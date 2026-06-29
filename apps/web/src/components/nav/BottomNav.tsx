import {
  CalendarDays,
  ChevronDown,
  LogIn,
  LogOut,
  Menu,
  PencilLine,
  Settings,
  Sparkles,
  StickyNote,
  UserRound,
} from "lucide-react";
import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import { ThemeToggle } from "../theme/ThemeToggle";

const navItems = [
  { to: "/", label: "Today", icon: PencilLine },
  { to: "/notes", label: "Notes", icon: StickyNote },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
];

function getDisplayName(user: NonNullable<ReturnType<typeof useAuth>["user"]>) {
  return user.displayName?.trim() || user.email;
}

function getInitials(name: string) {
  const [first = "", second = ""] = name
    .replace(/@.*/, "")
    .split(/\s+|[._-]+/)
    .filter(Boolean);

  return `${first[0] ?? ""}${second[0] ?? first[1] ?? ""}`.toUpperCase() || "MB";
}

export function BottomNav() {
  const { isLoading, logout, ownerKind, user } = useAuth();
  const navigate = useNavigate();
  const [isLoggingOut, setLoggingOut] = useState(false);
  const [isAccountMenuOpen, setAccountMenuOpen] = useState(false);
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
      setAccountMenuOpen(false);
      setMobileMenuOpen(false);
      navigate("/", { replace: true });
    } finally {
      setLoggingOut(false);
    }
  }

  const displayName = user ? getDisplayName(user) : "";
  const initials = displayName ? getInitials(displayName) : "";

  return (
    <nav className="fixed bottom-0 left-0 z-30 h-[64px] w-full border-t border-bloom-border bg-bloom-surface px-3 md:sticky md:top-0 md:flex md:h-16 md:items-center md:border-b md:border-t-0 md:px-6">
      <div className="hidden min-w-[280px] items-center md:flex">
        <NavLink
          to="/"
          end
          className="flex items-center gap-3 rounded-bloom-sm text-bloom-text-primary transition-colors hover:text-bloom-accent"
          aria-label="MindBloom home"
        >
          <span className="grid h-9 w-9 place-items-center rounded-full bg-bloom-accent text-bloom-on-accent shadow-sm">
            <Sparkles aria-hidden="true" className="h-4 w-4" strokeWidth={1.9} />
          </span>
          <span className="font-serif text-[26px] font-semibold leading-none">
            MindBloom
          </span>
        </NavLink>
      </div>

      <div className="grid h-full grid-cols-4 items-center gap-1 md:flex md:h-auto md:flex-1 md:items-center md:justify-center md:gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium transition-colors md:h-9 md:flex-row md:gap-2 md:px-4 md:text-[13px]",
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

        <div className="relative md:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen((current) => !current)}
            disabled={isLoggingOut}
            className="flex h-11 w-full flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium text-bloom-text-tertiary transition-colors hover:text-bloom-text-secondary disabled:cursor-not-allowed disabled:opacity-50"
            aria-haspopup="menu"
            aria-expanded={isMobileMenuOpen}
            aria-label="Open navigation menu"
          >
            <Menu aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            <span>More</span>
          </button>

          {isMobileMenuOpen ? (
            <div
              className="absolute bottom-14 right-0 z-50 w-56 rounded-bloom-sm border border-bloom-border bg-bloom-surface p-2 shadow-lg"
              role="menu"
            >
              {user ? (
                <div className="border-b border-bloom-border px-3 py-2">
                  <p className="truncate text-[13px] font-semibold text-bloom-text-primary">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-bloom-text-tertiary">
                    {user.email}
                  </p>
                </div>
              ) : (
                <div className="border-b border-bloom-border px-3 py-2">
                  <p className="text-[13px] font-semibold text-bloom-text-primary">
                    MindBloom
                  </p>
                  <p className="text-[11px] text-bloom-text-tertiary">
                    {ownerKind === "demo" ? "Demo mode" : "Account"}
                  </p>
                </div>
              )}
              <NavLink
                to="/settings"
                onClick={() => setMobileMenuOpen(false)}
                className="mt-2 flex h-9 w-full items-center gap-2 rounded-bloom-sm px-3 text-[12px] font-medium text-bloom-text-secondary transition-colors hover:bg-gray-bg hover:text-bloom-text-primary"
                role="menuitem"
              >
                <Settings className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                Settings
              </NavLink>
              {user ? (
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                  className="flex h-9 w-full items-center gap-2 rounded-bloom-sm px-3 text-left text-[12px] font-medium text-bloom-text-secondary transition-colors hover:bg-gray-bg hover:text-bloom-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  role="menuitem"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  {isLoggingOut ? "Logging out" : "Logout"}
                </button>
              ) : (
                <NavLink
                  to="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-9 w-full items-center gap-2 rounded-bloom-sm px-3 text-[12px] font-medium text-bloom-text-secondary transition-colors hover:bg-gray-bg hover:text-bloom-text-primary"
                  role="menuitem"
                >
                  <LogIn aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  Login
                </NavLink>
              )}
              <div className="mt-2 border-t border-bloom-border pt-2">
                <ThemeToggle mobile />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="hidden min-w-[280px] items-center justify-end gap-3 md:flex">
        <ThemeToggle />
        {isLoading ? (
          <p className="text-[12px] text-bloom-text-secondary">Checking...</p>
        ) : user ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setAccountMenuOpen((current) => !current)}
              disabled={isLoggingOut}
              className="flex h-10 items-center gap-2 rounded-full border border-bloom-border bg-bloom-bg px-2 pr-3 text-[12px] font-medium text-bloom-text-secondary transition-colors hover:text-bloom-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              aria-haspopup="menu"
              aria-expanded={isAccountMenuOpen}
              aria-label="Open account menu"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bloom-accent text-[12px] font-semibold text-bloom-on-accent">
                {initials}
              </span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
            </button>

            {isAccountMenuOpen ? (
              <div
                className="absolute right-0 top-12 z-50 w-56 rounded-bloom-sm border border-bloom-border bg-bloom-surface p-2 shadow-lg"
                role="menu"
              >
                <div className="border-b border-bloom-border px-3 py-2">
                  <p className="truncate text-[13px] font-semibold text-bloom-text-primary">
                    {displayName}
                  </p>
                  <p className="truncate text-[11px] text-bloom-text-tertiary">
                    {user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setAccountMenuOpen(false)}
                  className="mt-2 flex h-9 w-full items-center gap-2 rounded-bloom-sm px-3 text-left text-[12px] font-medium text-bloom-text-secondary transition-colors hover:bg-gray-bg hover:text-bloom-text-primary"
                  role="menuitem"
                >
                  <UserRound className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                  Profile
                </button>
                <NavLink
                  to="/settings"
                  onClick={() => setAccountMenuOpen(false)}
                  className="flex h-9 w-full items-center gap-2 rounded-bloom-sm px-3 text-[12px] font-medium text-bloom-text-secondary transition-colors hover:bg-gray-bg hover:text-bloom-text-primary"
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" aria-hidden="true" strokeWidth={1.8} />
                  Settings
                </NavLink>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                  className="flex h-9 w-full items-center gap-2 rounded-bloom-sm px-3 text-left text-[12px] font-medium text-bloom-text-secondary transition-colors hover:bg-gray-bg hover:text-bloom-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                  role="menuitem"
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
                  {isLoggingOut ? "Logging out" : "Logout"}
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <p className="text-[12px] text-bloom-text-secondary">
              Demo mode{ownerKind === "demo" ? " - one temporary entry" : ""}
            </p>
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                [
                  "grid h-9 w-9 place-items-center rounded-full border border-bloom-border transition-colors",
                  isActive
                    ? "bg-bloom-accent-bg text-bloom-accent"
                    : "bg-bloom-bg text-bloom-text-secondary hover:text-bloom-text-primary",
                ].join(" ")
              }
              aria-label="Open settings"
              title="Settings"
            >
              <Settings aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            </NavLink>
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
