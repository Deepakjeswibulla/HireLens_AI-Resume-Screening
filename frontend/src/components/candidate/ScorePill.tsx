import { cn, formatScore, scoreTone } from "@/lib/utils";

const TONE_BAR: Record<string, string> = {
  success: "bg-success",
  primary: "bg-primary",
  warning: "bg-warning",
  danger: "bg-destructive",
};

const TONE_TEXT: Record<string, string> = {
  success: "text-success-foreground",
  primary: "text-accent-foreground",
  warning: "text-warning-foreground",
  danger: "text-destructive",
};

export function ScorePill({
  score,
  label,
  size = "md",
  showLabel = true,
}: {
  score: number | null | undefined;
  label?: string | null;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}) {
  const tone = scoreTone(score);
  const value = score ?? 0;

  if (size === "lg") {
    return (
      <div className="flex items-center gap-4">
        <div
          className="relative flex size-20 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `conic-gradient(hsl(var(--${tone === "primary" ? "primary" : tone})) ${value * 3.6}deg, hsl(var(--muted)) 0deg)`,
          }}
          role="img"
          aria-label={score === null || score === undefined ? "Not scored" : `Match score ${formatScore(score)} out of 100`}
        >
          <div className="flex size-[68px] flex-col items-center justify-center rounded-full bg-card">
            <span className="text-xl font-semibold tabular-nums leading-none">{formatScore(score)}</span>
            <span className="mt-0.5 text-2xs text-muted-foreground">/ 100</span>
          </div>
        </div>
        <div className="min-w-0">
          <p className={cn("text-sm font-semibold", TONE_TEXT[tone])}>{label ?? "Not scored"}</p>
          <p className="mt-0.5 text-2xs text-muted-foreground">Overall match score</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-w-[92px]", size === "sm" && "min-w-[78px]")}>
      <div className="flex items-baseline gap-1.5">
        <span className={cn("font-semibold tabular-nums", size === "sm" ? "text-[13px]" : "text-sm")}>
          {formatScore(score)}
        </span>
        {showLabel && label ? (
          <span className={cn("truncate text-2xs font-medium", TONE_TEXT[tone])}>{label}</span>
        ) : null}
      </div>
      <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={cn("h-full rounded-full", TONE_BAR[tone])}
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}

export function ComponentBar({
  label,
  score,
  weight,
  available = true,
}: {
  label: string;
  score: number | null | undefined;
  weight: number;
  available?: boolean;
}) {
  const tone = scoreTone(score);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium text-foreground">
          {label}
          <span className="ml-1.5 text-2xs font-normal text-muted-foreground">
            {Math.round(weight * 100)}% weight
          </span>
        </p>
        <p className="text-[13px] font-semibold tabular-nums">
          {available ? formatScore(score) : <span className="text-2xs font-medium text-muted-foreground">not scored</span>}
        </p>
      </div>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        {available ? (
          <div
            className={cn("h-full rounded-full transition-[width] duration-500", TONE_BAR[tone])}
            style={{ width: `${Math.max(0, Math.min(100, score ?? 0))}%` }}
          />
        ) : null}
      </div>
    </div>
  );
}
