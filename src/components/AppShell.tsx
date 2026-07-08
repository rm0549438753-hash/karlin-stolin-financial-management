import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Receipt, BarChart3, Settings as SettingsIcon, LogOut,
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

const NAVY = "#001529";
const GOLD = "#D4AF37";

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { data: role } = useUserRole();

  const onTransactions = path === "/transactions" || path.startsWith("/transactions/");

  return (
    <Sidebar
      side="right"
      collapsible="icon"
      className="border-l border-l-white/10"
    >
      <SidebarHeader className="p-0" style={{ background: NAVY }}>
        <Link
          to="/dashboard"
          className="flex flex-col items-center text-center px-4 py-5 border-b border-white/10 group-data-[collapsible=icon]:py-3 group-data-[collapsible=icon]:px-2"
        >
          <div
            className="h-14 w-14 rounded-xl flex items-center justify-center p-0 overflow-hidden shadow-lg group-data-[collapsible=icon]:h-9 group-data-[collapsible=icon]:w-9"
            style={{
              background: `linear-gradient(135deg, ${GOLD}, #F3E5AB)`,
            }}
          >
            <img
              src={logoAsset.url}
              alt="מרכז קארלין סטאלין"
              className="h-[115%] w-[115%] object-contain scale-110"
            />
          </div>
          <div className="mt-3 group-data-[collapsible=icon]:hidden">
            <h2 className="text-sm font-extrabold leading-tight tracking-tight text-white">
              מרכז קארלין סטאלין
            </h2>
            <p className="text-white/60 text-[10px] font-medium mt-0.5">ניהול פיננסי</p>
          </div>
        </Link>
      </SidebarHeader>
      <SidebarContent className="text-white" style={{ background: NAVY }}>
        <SidebarGroup>
          <SidebarGroupLabel className="text-white/40 text-[10px] tracking-widest font-bold uppercase">
            תפריט
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={path === "/dashboard"}
                  tooltip="לוח בקרה"
                  className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-4"
                >
                  <Link to="/dashboard" className="flex items-center gap-3">
                    <LayoutDashboard className="!w-[18px] !h-[18px]" />
                    <span>לוח בקרה</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={onTransactions}
                  tooltip="תנועות"
                  className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-4"
                >
                  <Link to="/transactions" className="flex items-center gap-3">
                    <Receipt className="!w-[18px] !h-[18px]" />
                    <span>תנועות</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={path === "/reports"}
                  tooltip="דוחות"
                  className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-4"
                >
                  <Link to="/reports" className="flex items-center gap-3">
                    <BarChart3 className="!w-[18px] !h-[18px]" />
                    <span>דוחות</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {(role?.isAdmin || role?.isEditor) && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={path === "/settings"}
                    tooltip="הגדרות"
                    className="text-white/70 hover:bg-white/10 hover:text-white data-[active=true]:bg-white/15 data-[active=true]:text-white data-[active=true]:font-bold py-4"
                  >
                    <Link to="/settings" className="flex items-center gap-3">
                      <SettingsIcon className="!w-[18px] !h-[18px]" />
                      <span>הגדרות</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2 pb-8 border-t border-white/10" style={{ background: NAVY }}>
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
    <div className="flex flex-col gap-2 text-white">
      <div className="px-2 py-1 group-data-[collapsible=icon]:hidden">
        <div className="text-xs font-bold truncate">{user?.email}</div>
        <div className="text-[10px] text-white/60">
          {role?.isAdmin ? "מנהל" : role?.roles?.includes("editor") ? "עורך" : "צופה"}
        </div>
      </div>
      <Button
        onClick={signOut}
        variant="ghost"
        size="sm"
        className="justify-start gap-2 text-white/80 hover:bg-white/10 hover:text-white"
      >
        <LogOut className="w-4 h-4" />
        <span className="group-data-[collapsible=icon]:hidden">התנתקות</span>
      </Button>
    </div>
  );
}

export function AppShell({ children, title, actions }: { children: ReactNode; title: string; actions?: ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full bg-background" dir="rtl">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white/80 dark:bg-card/80 backdrop-blur-md border-b border-border flex items-center px-4 md:px-6 gap-3 md:gap-4 sticky top-0 z-10">
            <SidebarTrigger className="text-slate-600 hover:bg-slate-100 dark:text-foreground/70 dark:hover:bg-white/10 h-9 w-9" />
            <div className="flex flex-col min-w-0 flex-1">
              <h1 className="text-base md:text-lg font-extrabold leading-none tracking-tight truncate text-slate-800 dark:text-foreground">
                {title}
              </h1>
              <p className="text-slate-500 dark:text-muted-foreground text-[11px] font-medium mt-1 hidden sm:block">
                מרכז קארלין סטאלין · ניהול פיננסי
              </p>
            </div>
            <div className="mr-auto flex items-center gap-1.5 flex-wrap justify-end">
              <GlobalSearch />
              <ThemeToggle />
              {actions}
            </div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
