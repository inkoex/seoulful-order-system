import { Outlet, useLocation, useNavigate } from "react-router";
import { useEffect } from "react";
import { requireAuth } from "@/lib/auth.server";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import type { Route } from "./+types/admin";

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  return null;
}

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === "/admin" || location.pathname === "/admin/") {
      navigate("/admin/dashboard", { replace: true });
    }
  }, [location.pathname, navigate]);

  return (
    <SidebarProvider>
      <div className="admin-b2b admin-b2b-shell flex h-screen w-full text-foreground">
        <AdminSidebar />
        <SidebarInset>
          <header className="admin-b2b-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border/80 px-4">
            <SidebarTrigger className="-ml-1 bg-white/70" />
            <div className="h-4 w-[1px] bg-border mx-2" />
            <h2 className="text-base font-semibold tracking-tight text-slate-800">Seoulful Order System</h2>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
