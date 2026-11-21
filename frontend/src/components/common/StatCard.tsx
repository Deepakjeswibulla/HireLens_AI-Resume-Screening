import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: "default" | "primary" | "success" | "warning";
}) {
  const toneRing = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
  }[tone];

  return (
    <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <p className="label-muted">{label}</p>
        {icon ? <span className={cn("[&_svg]:size-4", toneRing)}>{icon}</span> : null}
      </div>
      <p className="metric-value mt-2">{value}</p>
      {hint ? <p className="mt-1 text-2xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
