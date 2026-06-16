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
    <div className="inline-flex rounded-bloom-sm border border-bloom-border bg-bloom-bg p-1">
      {options.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          onClick={() => onChange(value)}
          aria-pressed={active === value}
          className={[
            "flex h-8 items-center gap-1.5 rounded-bloom-sm px-3 text-[12px] font-medium transition-colors",
            active === value
              ? "bg-bloom-surface text-bloom-text-primary shadow-sm"
              : "text-bloom-text-tertiary hover:text-bloom-text-secondary",
          ].join(" ")}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
