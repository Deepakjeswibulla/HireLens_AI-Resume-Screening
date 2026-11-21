import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { useFetch } from "@/hooks/useFetch";

const COLLAPSE_KEY = "hirelens-sidebar-collapsed";
const APP_VERSION = "1.0.0";

export function AppShell() {
  const [collapsed, setCollapsed] = useState(() => window.localStorage.getItem(COLLAPSE_KEY) === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const { data: config, error: configError } = useFetch(() => api.config(), []);
  const { data: overview } = useFetch(() => api.overview(), []);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const semantic = overview?.semantic ?? config?.semantic ?? null;

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-h-screen bg-background">
        <Sidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onNavigate={() => setMobileOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header
            collapsed={collapsed}
            onToggleSidebar={() => setCollapsed((value) => !value)}
            onOpenMobile={() => setMobileOpen(true)}
            semantic={semantic ? { state: semantic.state, method: semantic.method } : null}
          />

          {configError ? (
            <div className="flex items-start gap-2 border-b border-warning/30 bg-warning-subtle px-4 py-2 text-[13px] text-warning-foreground sm:px-6">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>
                The HireLens API is not responding. Start the backend (<code className="font-mono">uvicorn app.main:app</code>)
                and refresh this page.
              </p>
            </div>
          ) : null}

          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6 lg:py-8">
            <Outlet />
          </main>

          <footer className="mt-auto border-t border-border px-4 py-3 text-2xs text-muted-foreground sm:px-6">
            <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-2">
              <span>HireLens · scores are decision support, not hiring decisions</span>
              <span className="font-mono">
                v{APP_VERSION} · build {__BUILD_STAMP__}
              </span>
            </div>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}
