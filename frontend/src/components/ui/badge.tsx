import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-2xs font-medium leading-4 transition-colors",
  {
    variants: {
      tone: {
        neutral: "border-border bg-muted text-secondary-foreground",
        muted: "border-border bg-muted text-secondary-foreground",
        primary: "border-primary/20 bg-primary-subtle text-accent-foreground",
        success: "border-success/25 bg-success-subtle text-success-foreground",
        warning: "border-warning/25 bg-warning-subtle text-warning-foreground",
        danger: "border-destructive/25 bg-destructive/10 text-destructive",
        outline: "border-border bg-transparent text-muted-foreground",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
