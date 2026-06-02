import type { ReactNode } from "react";

import type { ColorRamp } from "../../lib/topicColors";
import { colorClasses } from "../../lib/topicColors";

interface BloomCardProps {
  children: ReactNode;
  color: ColorRamp;
  label: string;
  className?: string;
}

export function BloomCard({
  children,
  color,
  label,
  className = "",
}: BloomCardProps) {
  const ramp = colorClasses[color];

  return (
    <section
      className={[
        "rounded-bloom-lg border p-5",
        ramp.bg,
        ramp.border,
        ramp.text,
        className,
      ].join(" ")}
    >
      <p className="mb-2 text-[10px] uppercase tracking-[0.12em] opacity-70">
        {label}
      </p>
      {children}
    </section>
  );
}
