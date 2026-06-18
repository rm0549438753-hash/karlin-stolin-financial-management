import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Receipt, BarChart3, Settings as SettingsIcon, LogOut, ChevronDown,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthUser, useUserRole } from "@/hooks/use-auth";
import { useAccounts } from "@/hooks/use-lookups";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
  SidebarProvider, SidebarTrigger, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import logoAsset from "@/assets/karlin-logo.png.asset.json";

function AppSidebar() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search }) as Record<string, unknown>;
  const { data: role } = useUserRole();
  const { data: accounts = [] } = useAccounts();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [txOpen, setTxOpen] = useState(true);

  const activeAccount = typeof search?.account === "string" ? (search.account as string) : null;
  const onTransactions = path === "/transactions" || path.startsWith("/transactions/");

  return (
    <Sidebar side="right" collapsible="icon">
      <SidebarHeader className="p-4">
        <Link to="/dashboard" className="flex items-center gap-3">
          <img src={logoAsset.url} alt="מוסדות קרלין" className="w-10 h-10 object-contain shrink-0" />
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
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/dashboard"} tooltip="לוח בקרה">
                  <Link to="/dashboard" className="flex items-center gap-3">
                    <LayoutDashboard className="w-4 h-4" />
                    <span>לוח בקרה</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <Collapsible open={txOpen || collapsed} onOpenChange={setTxOpen} asChild>
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton isActive={onTransactions} tooltip="תנועות">
                      <Receipt className="w-4 h-4" />
                      <span>תנועות</span>
                      <ChevronDown className="mr-auto w-4 h-4 transition-transform group-data-[state=open]/collapsible:rotate-180 group-data-[collapsible=icon]:hidden" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton asChild isActive={onTransactions && !activeAccount}>
                          <Link to="/transactions" className="font-medium">כל התנועות</Link>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      {accounts.map((a) => (
                        <SidebarMenuSubItem key={a.id}>
                          <SidebarMenuSubButton asChild isActive={onTransactions && activeAccount === a.id}>
                            <Link to="/transactions" search={{ account: a.id }}>
                              {a.name}
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                      {accounts.length === 0 && (
                        <li className="px-3 py-1.5 text-xs text-muted-foreground">אין חשבונות</li>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>

              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={path === "/reports"} tooltip="דוחות">
                  <Link to="/reports" className="flex items-center gap-3">
                    <BarChart3 className="w-4 h-4" />
                    <span>דוחות</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {role?.isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={path === "/settings"} tooltip="הגדרות">
                    <Link to="/settings" className="flex items-center gap-3">
                      <SettingsIcon className="w-4 h-4" />
                      <span>הגדרות</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
            <img src={logoAsset.url} alt="" className="h-8 w-8 object-contain" />
            <h1 className="text-base font-semibold">{title}</h1>
            <div className="mr-auto flex items-center gap-2">{actions}</div>
          </header>
          <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
