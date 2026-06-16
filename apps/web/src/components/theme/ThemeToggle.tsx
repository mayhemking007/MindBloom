import { Moon, Sun } from "lucide-react";

import { useTheme } from "../../theme/ThemeContext";

interface ThemeToggleProps {
  mobile?: boolean;
}

export function ThemeToggle({ mobile = false }: ThemeToggleProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  const Icon = isDark ? Sun : Moon;
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";

  if (mobile) {
    return (
      <button
        type="button"
        onClick={toggleTheme}
        className="flex h-11 flex-col items-center justify-center gap-1 rounded-bloom-sm text-[11px] font-medium text-bloom-text-tertiary transition-colors hover:text-bloom-text-secondary"
        aria-label={label}
        title={label}
      >
        <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
        <span>{isDark ? "Light" : "Dark"}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="grid h-9 w-9 place-items-center rounded-full border border-bloom-border bg-bloom-bg text-bloom-text-secondary transition-colors hover:text-bloom-text-primary"
      aria-label={label}
      title={label}
    >
      <Icon aria-hidden="true" className="h-4 w-4" strokeWidth={1.8} />
    </button>
  );
}
