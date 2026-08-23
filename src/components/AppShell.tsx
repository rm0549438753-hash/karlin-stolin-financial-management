import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Receipt, BarChart3, Settings as SettingsIcon, LogOut, ShieldCheck,
} from "lucide-react";
import { type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useUserRole } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, SidebarTrigger, SidebarHeader, SidebarFooter,
} from "@/components/ui/sidebar";
import logoAsset from "@/assets/karlin-logo.png.asset.json";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GlobalSearch } from "@/components/GlobalSearch";
import { NotificationBell } from "@/components/NotificationBell";

import { useIdleLogout } from "@/hooks/use-idle-logout";

const GOLD = "#D4AF37";

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: role } = useUserRole();

  const onTransactions = path === "/transactions" || path.startsWith("/transactions/");


  return (
    <Sidebar side="right" collapsible="icon" className="border-l-4 border-l-[color:var(--brand-gold,theme(colors.amber.400))]" style={{ ["--brand-gold" as any]: GOLD }}>
      <SidebarHeader className="p-0 bg-gradient-to-b from-[#144a7a] to-[#0d3b66]">
        <Link to="/dashboard" className="flex flex-col items-center text-center px-6 py-7 border-b border-white/10 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:px-2">
          <div
            className="h-32 w-32 bg-white rounded-2xl flex items-center justify-center p-0 overflow-hidden shadow-xl mb-4 group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9 group-data-[collapsible=icon]:mb-0"
            style={{ border: `3px solid ${GOLD}` }}
          >
            <img src={logoAsset.url} alt="מרכז קארלין סטאלין" className="h-[115%] w-[115%] object-contain scale-110" />
          </div>
          <div className="group-data-[collapsible=icon]:hidden">
            <h2 className="text-xl font-extrabold leading-tight tracking-tight" style={{ color: GOLD }}>
              מרכז קארלין סטאלין
            </h2>
            <div className="h-1 w-10 mx-auto rounded-full my-2" style={{ background: GOLD }} />
            <p className="text-white/70 text-xs font-semibold">ממשק ניהול פיננסי</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="bg-[#0d3b66] text-white">
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/50 text-[11px] tracking-widest font-bold">תפריט</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/dashboard"} tooltip="לוח בקרה" className="text-white hover:bg-white/10 data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-5 text-base">
                  <Link to="/dashboard" className="flex items-center gap-3">
                    <LayoutDashboard className="!w-5 !h-5" />
                    <span>לוח בקרה</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={onTransactions} tooltip="תנועות" className="text-white hover:bg-white/10 data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-5 text-base">
                  <Link to="/transactions" className="flex items-center gap-3">
                    <Receipt className="!w-5 !h-5" />
                    <span>תנועות</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>


              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/reports"} tooltip="דוחות" className="text-white hover:bg-white/10 data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-5 text-base">
                  <Link to="/reports" className="flex items-center gap-3">
                    <BarChart3 className="!w-5 !h-5" />
                    <span>דוחות</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {(role?.isAdmin || role?.isEditor || role?.isFullViewer) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/settings"} tooltip="הגדרות מערכת" className="text-white hover:bg-white/10 data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-5 text-base">
                    <Link to="/settings" className="flex items-center gap-3">
                      <SettingsIcon className="!w-5 !h-5" />
                      <span>הגדרות מערכת</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {role?.canViewSuperAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/admin-settings"} tooltip="הגדרות ניהול" className="text-white hover:bg-white/10 data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-5 text-base">
                    <Link to="/admin-settings" className="flex items-center gap-3">
                      <ShieldCheck className="!w-5 !h-5" />
                      <span>הגדרות ניהול</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}


            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 pb-12 bg-[#0d3b66] border-t border-white/10">
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
    const { logSessionEvent } = await import("@/lib/security.functions");
    const { getDeviceKey } = await import("@/lib/device-key");
    await logSessionEvent({ data: { deviceKey: getDeviceKey(), eventType: "logout" } }).catch(() => null);
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="flex flex-col gap-2 text-white">
      <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
        <div className="text-xs font-bold truncate">{user?.email}</div>
        <div className="text-[10px] text-white/60">{role?.isFullViewer ? "אורח · צפייה בלבד" : role?.isAdmin ? "מנהל" : role?.roles?.includes("editor") ? "עורך" : "צופה"}</div>
      </div>
      <div className="px-2 group-data-[collapsible=icon]:hidden">
        <Link to="/download" className="text-xs font-semibold underline hover:text-white/80">להורדת האפליקציה</Link>
      </div>
      <div className="px-2 flex items-center gap-2 text-[10px] text-white/60 group-data-[collapsible=icon]:hidden">
        <Link to="/privacy" className="underline hover:text-white">מדיניות פרטיות</Link>
        <span>·</span>
        <Link to="/terms" className="underline hover:text-white">תנאי שימוש</Link>
      </div>
      <Button onClick={signOut} variant="ghost" size="sm" className="justify-start gap-2 text-white hover:bg-white/10 hover:text-white">
        <LogOut className="w-4 h-4" />
        <span className="group-data-[collapsible=icon]:hidden">התנתקות</span>
      </Button>
    </div>
  );
}

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  useIdleLogout();
  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header
            className="app-header min-h-16 md:min-h-24 bg-[#0d3b66] shadow-2xl flex items-center px-3 md:px-8 gap-2 md:gap-6 sticky top-0 z-10"
            style={{ borderBottom: `4px solid ${GOLD}` }}
          >
            <SidebarTrigger className="text-white hover:bg-white/10 h-10 w-10 shrink-0" />
            <div
              className="h-10 w-10 md:h-16 md:w-16 bg-white rounded-full flex items-center justify-center p-0 overflow-hidden shadow-inner shrink-0"
              style={{ border: `2px solid ${GOLD}` }}
            >
              <img src={logoAsset.url} alt="" className="h-[120%] w-[120%] object-contain scale-110" />
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-base md:text-2xl font-extrabold leading-tight tracking-tight truncate" style={{ color: GOLD }}>{title}</h1>
              <p className="text-white/60 text-xs md:text-sm font-medium mt-1 hidden sm:block">מרכז קארלין סטאלין · ניהול פיננסי</p>
            </div>
            <div className="mr-auto flex items-center gap-1 md:gap-2 justify-end shrink-0">
              <GlobalSearch />
              <NotificationBell />
              <ThemeToggle />
              <div className="hidden md:flex items-center gap-2">{actions}</div>
            </div>

          </header>
          {actions && (
            <div className="md:hidden scroll-x-hint flex items-center gap-2 whitespace-nowrap px-3 py-2 border-b bg-card/60 [&_button]:shrink-0 [&_a]:shrink-0">
              {actions}
            </div>
          )}
          <main className="flex-1 p-3 md:p-6 overflow-x-hidden pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
