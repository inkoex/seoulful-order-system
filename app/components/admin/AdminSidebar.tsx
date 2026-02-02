import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  FolderOpen,
  Building,
  Megaphone,
  LogOut,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const menuItems = [
  { path: "/admin/dashboard", label: "대시보드", icon: LayoutDashboard },
  { path: "/admin/orders", label: "주문 관리", icon: ShoppingCart },
  { path: "/admin/products", label: "상품 관리", icon: Package },
  { path: "/admin/categories", label: "카테고리 관리", icon: FolderOpen },
  { path: "/admin/apartments", label: "아파트 관리", icon: Building },
  { path: "/admin/notices", label: "공지 관리", icon: Megaphone },
];

export function AdminSidebar() {
  const location = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex h-16 items-center border-b px-4 transition-all duration-300">
        <div className="flex w-full items-center gap-3">
          <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shrink-0 outline-none">
            <LayoutDashboard className="size-5" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none transition-all duration-300 overflow-hidden whitespace-nowrap group-data-[state=collapsed]/sidebar:opacity-0 group-data-[state=collapsed]/sidebar:w-0">
            <span className="font-semibold text-sm">관리자</span>
            <span className="text-[11px] text-muted-foreground">Seoul Order</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarMenu className="gap-1 px-4 py-4 transition-all duration-300">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);

            return (
              <SidebarMenuItem key={item.path}>
                <SidebarMenuButton asChild variant={isActive ? "active" : "default"} className="px-0">
                  <Link to={item.path}>
                    <div className="flex w-8 items-center justify-center shrink-0">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="transition-all duration-300 overflow-hidden whitespace-nowrap group-data-[state=collapsed]/sidebar:w-0 group-data-[state=collapsed]/sidebar:opacity-0">{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="border-t px-4 py-3 transition-all duration-300">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="px-0">
              <Link to="/admin/logout">
                <div className="flex w-8 items-center justify-center shrink-0">
                  <LogOut className="h-5 w-5" />
                </div>
                <span className="transition-all duration-300 overflow-hidden whitespace-nowrap group-data-[state=collapsed]/sidebar:w-0 group-data-[state=collapsed]/sidebar:opacity-0">로그아웃</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
