import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Receipt, BarChart3, Settings as SettingsIcon, LogOut,
} from "lucide-react";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useUserRole } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import { Wallet } from "lucide-react";

const baseItems = [
  { title: "לוח בקרה", url: "/dashboard", icon: LayoutDashboard },
  { title: "תנועות", url: "/transactions", icon: Receipt },
  { title: "דוחות", url: "/reports", icon: BarChart3 },
];

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: role } = useUserRole();
  const items = role?.isAdmin
    ? [...baseItems, { title: "הגדרות", url: "/settings", icon: SettingsIcon }]
    : baseItems;

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="p-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-primary text-primary-foreground grid place-items-center shadow">
            <Wallet className="w-5 h-5" />
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-sm">מוסדות קרלין</span>
            <span className="text-xs text-muted-foreground">ניהול כספים</span>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>תפריט</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => {
                const active = path === item.url || path.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild isActive={active} tooltip={item.title}>
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="w-4 h-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}

function UserMenu() {
  const { user } = useAuthUser();
  const { data: role } = useUserRole();
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
        <div className="text-xs font-medium truncate">{user?.email}</div>
        <div className="text-[10px] text-muted-foreground">{role?.isAdmin ? "מנהל" : "עורך"}</div>
      </div>
      <Button onClick={signOut} variant="ghost" size="sm" className="justify-start gap-2">
        <LogOut className="w-4 h-4" />
        <span className="group-data-[collapsible=icon]:hidden">התנתקות</span>
      </Button>
    </div>
  );
}

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 border-b bg-card/50 backdrop-blur flex items-center px-4 gap-3 sticky top-0 z-10">
            <SidebarTrigger />
            <h1 className="text-base font-semibold">{title}</h1>
            <div className="mr-auto flex items-center gap-2">{actions}</div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
