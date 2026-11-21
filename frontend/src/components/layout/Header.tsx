import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Menu, Moon, PanelLeftClose, PanelLeftOpen, Sun, UserRound } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";

const CRUMBS: Record<string, string> = {
  "": "Overview",
  jobs: "Jobs / Screenings",
  screenings: "Screenings",
  candidates: "Candidate",
  analytics: "Analytics",
  settings: "Settings",
  help: "Help & documentation",
  new: "New screening",
  processing: "Processing",
  compare: "Comparison",
};

function buildCrumbs(pathname: string): { label: string; to: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; to: string }[] = [{ label: "HireLens", to: "/" }];
  let path = "";
  segments.forEach((segment) => {
    path += `/${segment}`;
    const isId = /^\d+$/.test(segment);
    crumbs.push({ label: isId ? `#${segment}` : CRUMBS[segment] ?? segment, to: path });
  });
  return crumbs;
}

interface HeaderProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  onOpenMobile: () => void;
  semantic: { state: string; method: string } | null;
}

export function Header({ collapsed, onToggleSidebar, onOpenMobile, semantic }: HeaderProps) {
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const crumbs = buildCrumbs(location.pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onOpenMobile}
        className="lg:hidden"
        aria-label="Open navigation"
      >
        <Menu />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleSidebar}
        className="hidden lg:inline-flex"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </Button>

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1 overflow-hidden text-[13px] text-muted-foreground">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.to} className="flex min-w-0 items-center gap-1">
                {index > 0 ? <ChevronRight className="size-3 shrink-0 text-border" aria-hidden /> : null}
                {last ? (
                  <span className={cn("truncate font-medium text-foreground")} aria-current="page">
                    {crumb.label}
                  </span>
                ) : (
                  <Link to={crumb.to} className="truncate hover:text-foreground">
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      {semantic ? (
        <Badge
          tone={semantic.state === "ready" ? "success" : semantic.state === "loading" ? "warning" : "outline"}
          className="hidden sm:inline-flex"
          title={
            semantic.state === "ready"
              ? `Semantic matching: ${semantic.method}`
              : semantic.state === "loading"
                ? "Loading the embedding model…"
                : `Semantic backend: ${semantic.method}`
          }
        >
          <span className="size-1.5 rounded-full bg-current" aria-hidden />
          {semantic.state === "ready" ? "Semantic model ready" : semantic.state === "loading" ? "Loading model" : "TF-IDF fallback"}
        </Badge>
      ) : null}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleTheme}
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      >
        {theme === "light" ? <Moon /> : <Sun />}
      </Button>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex items-center gap-2 rounded-md px-1.5 py-1 text-[13px] font-medium hover:bg-muted"
            aria-label="Account menu"
          >
            <span className="flex size-6 items-center justify-center rounded-full bg-primary-subtle text-2xs font-semibold text-accent-foreground">
              DJ
            </span>
            <span className="hidden sm:inline">Deepak</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="z-50 w-56 rounded-md border border-border bg-popover p-1 text-[13px] shadow-md animate-fade-in"
          >
            <div className="px-2 py-1.5">
              <p className="font-medium">Deepak Jeswi</p>
              <p className="truncate text-2xs text-muted-foreground">vikramadityaof2006@gmail.com</p>
            </div>
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item asChild>
              <Link to="/settings" className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[highlighted]:bg-muted">
                <UserRound className="size-3.5" /> Workspace settings
              </Link>
            </DropdownMenu.Item>
            <DropdownMenu.Item asChild>
              <Link to="/help" className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 outline-none data-[highlighted]:bg-muted">
                About HireLens
              </Link>
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  );
}
