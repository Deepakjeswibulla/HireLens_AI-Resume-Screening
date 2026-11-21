import { Check, CircleDashed, HelpCircle, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type SkillMatchState = "exact" | "alias" | "related" | "semantic" | "missing" | "uncertain" | "preferred-missing";

const STATE_STYLES: Record<SkillMatchState, { className: string; icon: typeof Check; hint: string }> = {
  exact: {
    className: "border-success/30 bg-success-subtle text-success-foreground",
    icon: Check,
    hint: "Exact skill match found in the resume",
  },
  alias: {
    className: "border-success/25 bg-success-subtle/70 text-success-foreground",
    icon: Check,
    hint: "Matched through a known alias (e.g. JS → JavaScript)",
  },
  related: {
    className: "border-warning/30 bg-warning-subtle text-warning-foreground",
    icon: CircleDashed,
    hint: "Related skill only — partial credit, not an exact match",
  },
  semantic: {
    className: "border-primary/25 bg-primary-subtle text-accent-foreground",
    icon: CircleDashed,
    hint: "No explicit mention; semantic evidence in the resume text",
  },
  missing: {
    className: "border-destructive/25 bg-destructive/5 text-destructive",
    icon: X,
    hint: "No evidence of this required skill in the resume",
  },
  "preferred-missing": {
    className: "border-border bg-muted text-muted-foreground",
    icon: Minus,
    hint: "Preferred skill not found (does not block the match)",
  },
  uncertain: {
    className: "border-border bg-muted text-muted-foreground",
    icon: HelpCircle,
    hint: "Could not be extracted reliably — treated as unknown, not missing",
  },
};

export function SkillTag({
  skill,
  state = "exact",
  hint,
  className,
}: {
  skill: string;
  state?: SkillMatchState;
  hint?: string;
  className?: string;
}) {
  const style = STATE_STYLES[state];
  const Icon = style.icon;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex max-w-full items-center gap-1 truncate rounded-md border px-1.5 py-0.5 text-2xs font-medium",
            style.className,
            className,
          )}
        >
          <Icon className="size-2.5 shrink-0" aria-hidden />
          <span className="truncate">{skill}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{hint ?? style.hint}</TooltipContent>
    </Tooltip>
  );
}

export function SkillTags({
  skills,
  state,
  max = 3,
  emptyLabel = "—",
}: {
  skills: string[];
  state?: SkillMatchState;
  max?: number;
  emptyLabel?: string;
}) {
  if (!skills.length) return <span className="text-2xs text-muted-foreground">{emptyLabel}</span>;
  const shown = skills.slice(0, max);
  const extra = skills.length - shown.length;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((skill) => (
        <SkillTag key={skill} skill={skill} state={state} />
      ))}
      {extra > 0 ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge tone="outline" className="cursor-default">
              +{extra}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>{skills.slice(max).join(", ")}</TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
