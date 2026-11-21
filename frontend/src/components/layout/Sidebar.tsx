import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  BarChart3,
  BookOpen,
  Briefcase,
  LayoutDashboard,
  ScanSearch,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV_ITEMS = [
  { to: "/", label: "Overview", icon: LayoutDashboard, end: true },
  { to: "/screenings/new", label: "Screen Candidates", icon: ScanSearch },
  { to: "/jobs", label: "Jobs / Screenings", icon: Briefcase },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/settings", label: "Settings", icon: Settings },
];

interface SidebarProps {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate?: () => void;
}

export function Sidebar({ collapsed, mobileOpen, onCloseMobile, onNavigate }: SidebarProps) {
  const location = useLocation();

  const content = (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-14 items-center gap-2 border-b border-border px-4", collapsed && "justify-center px-0")}>
        <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Sparkles className="size-4" aria-hidden />
        </div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">HireLens</p>
            <p className="truncate text-2xs text-muted-foreground">Candidate intelligence</p>
          </div>
        ) : null}
        <button
          type="button"
          onClick={onCloseMobile}
          className="ml-auto rounded p-1 text-muted-foreground hover:bg-muted lg:hidden"
          aria-label="Close navigation"
        >
          <X className="size-4" />
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active =
            item.end
              ? location.pathname === item.to
              : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              title={collapsed ? item.label : undefined}
              className={cn(
                "relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-colors",
                active ? "text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                collapsed && "justify-center px-0",
              )}
              aria-current={active ? "page" : undefined}
            >
              {active ? (
                <motion.span
                  layoutId="sidebar-active"
                  className="absolute inset-0 rounded-md bg-primary-subtle"
                  transition={{ type: "spring", stiffness: 380, damping: 32 }}
                />
              ) : null}
              <Icon className="relative size-4 shrink-0" aria-hidden />
              {!collapsed ? <span className="relative truncate">{item.label}</span> : null}
            </NavLink>
          );
        })}
      </nav>

      <div className="space-y-0.5 border-t border-border px-2 py-3">
        <NavLink
          to="/help"
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
          title={collapsed ? "Help & documentation" : undefined}
        >
          <BookOpen className="size-4 shrink-0" aria-hidden />
          {!collapsed ? <span>Help & docs</span> : null}
        </NavLink>
        <div className={cn("flex items-center gap-2.5 rounded-md px-2.5 py-2", collapsed && "justify-center px-0")}>
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-secondary-foreground">
            DJ
          </div>
          {!collapsed ? (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-medium leading-tight">Deepak Jeswi</p>
              <p className="truncate text-2xs text-muted-foreground">Recruiter workspace</p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside
        className={cn(
          "hidden shrink-0 border-r border-border bg-sidebar transition-[width] duration-200 lg:block",
          collapsed ? "w-16" : "w-60",
        )}
      >
        {content}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/40 animate-fade-in"
            onClick={onCloseMobile}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-border bg-sidebar shadow-lg animate-slide-up">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}
