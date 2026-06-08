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
import { NavLink } from "react-router-dom";

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
  const { logout, user } = useAuth();

  return (
    <nav className="fixed bottom-0 left-0 z-30 h-[60px] w-full border-t border-bloom-border bg-bloom-surface px-3 md:sticky md:top-0 md:h-dvh md:w-[220px] md:border-r md:border-t-0 md:px-4 md:py-6">
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
            onClick={() => void logout()}
            className="flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium text-bloom-text-tertiary transition-colors hover:text-bloom-text-secondary md:h-10 md:flex-row md:justify-start md:gap-3 md:px-3 md:text-[13px]"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
            <span>Logout</span>
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
    </nav>
  );
}
