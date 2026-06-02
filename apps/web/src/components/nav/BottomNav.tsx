import { CalendarDays, Network, PencilLine, Sparkles } from "lucide-react";
import { NavLink } from "react-router-dom";

const navItems = [
  { to: "/", label: "Today", icon: PencilLine },
  { to: "/map", label: "Map", icon: Network },
  { to: "/timeline", label: "Timeline", icon: CalendarDays },
  { to: "/reflect", label: "Reflect", icon: Sparkles },
];

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-1/2 z-10 h-[60px] w-full max-w-[420px] -translate-x-1/2 border-t border-bloom-border bg-bloom-surface px-3">
      <div className="grid h-full grid-cols-4 items-center gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                [
                  "flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium transition-colors",
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
      </div>
    </nav>
  );
}
