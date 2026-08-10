import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, CheckCheck, RefreshCw, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNotifications, useNotificationActions, type AppNotification } from "@/hooks/use-notifications";
import { useUserRole } from "@/hooks/use-auth";
import { toast } from "sonner";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "עכשיו";
  if (min < 60) return `לפני ${min} דק'`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `לפני ${hours} שע'`;
  const days = Math.round(hours / 24);
  if (days < 30) return `לפני ${days} ימים`;
  return new Date(iso).toLocaleDateString("he-IL");
}

const SEVERITY_STYLES: Record<AppNotification["severity"], string> = {
  info: "border-r-primary",
  warning: "border-r-amber-500",
  critical: "border-r-destructive",
};

export function NotificationBell() {
  const { data: role } = useUserRole();
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useNotifications();
  const { markRead, markAllRead, remove, clearRead, invalidate } = useNotificationActions();

  // Viewers are read-only and receive no operational alerts.
  if (!role?.isAdmin && !role?.isEditor) return null;

  const unread = items.filter((n) => !n.read_at).length;

  async function refresh() {
    setRefreshing(true);
    try {
      const { refreshNotifications } = await import("@/lib/notifications.functions");
      const res = await refreshNotifications();
      await invalidate();
      toast.success(res.created ? `נמצאו ${res.created} התראות חדשות` : "אין התראות חדשות");
    } catch (e: any) {
      toast.error(e?.message ?? "רענון ההתראות נכשל");
    } finally {
      setRefreshing(false);
    }
  }

  function openItem(n: AppNotification) {
    if (!n.read_at) markRead.mutate(n.id);
    if (n.link) {
      setOpen(false);
      const [path, query] = n.link.split("?");
      const search = query
        ? Object.fromEntries(new URLSearchParams(query).entries())
        : undefined;
      navigate({ to: path, search: search as any });
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`התראות${unread ? ` — ${unread} חדשות` : ""}`}
          className="relative text-primary-foreground hover:bg-primary-foreground/10 h-10 w-10"
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -left-0.5 min-w-5 h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" dir="rtl" className="w-[22rem] p-0">
        <div className="flex items-center justify-between gap-2 px-3 py-2 border-b">
          <div className="font-bold text-sm">
            התראות {unread > 0 && <Badge variant="secondary" className="mr-1">{unread}</Badge>}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="בדיקה מחדש" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="סמן הכל כנקרא" onClick={() => markAllRead.mutate()} disabled={!unread}>
              <CheckCheck className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" title="נקה נקראו" onClick={() => clearRead.mutate()}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <ScrollArea className="max-h-96">
          {isLoading ? (
            <div className="p-3 space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">אין התראות כרגע.</div>
          ) : (
            <ul className="divide-y">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`group flex gap-2 px-3 py-2.5 border-r-4 ${SEVERITY_STYLES[n.severity]} ${n.read_at ? "opacity-60" : "bg-muted/40"}`}
                >
                  <button type="button" onClick={() => openItem(n)} className="flex-1 text-right">
                    <div className="text-sm font-semibold leading-snug">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{n.body}</div>}
                    <div className="text-[11px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
                    title="מחיקה"
                    onClick={() => remove.mutate(n.id)}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
