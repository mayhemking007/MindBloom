import { Sparkles, Waves } from "lucide-react";

import type { MapViewType } from "./types";

interface MapToggleProps {
  active: MapViewType;
  onChange: (view: MapViewType) => void;
}

const options: Array<{
  value: MapViewType;
  label: string;
  Icon: typeof Waves;
}> = [
  { value: "river", label: "Thought River", Icon: Waves },
  { value: "constellation", label: "Constellation", Icon: Sparkles },
];

export function MapToggle({ active, onChange }: MapToggleProps) {
  return (
    <div
      className="inline-flex rounded-bloom-sm border p-1"
      style={{
        background: "var(--map-canvas)",
        borderColor: "var(--map-border)",
      }}
    >
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={active === value}
          className="flex h-9 items-center gap-2 rounded-bloom-sm px-3 text-[13px] font-semibold transition-colors md:h-10 md:px-4 md:text-[14px]"
          style={{
            background: active === value ? "var(--map-card)" : "transparent",
            boxShadow: active === value ? "0 0 0 1px var(--map-card-border)" : "none",
            color: active === value ? "var(--map-text)" : "var(--map-faint)",
          }}
        >
          <Icon className="h-4 w-4" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
