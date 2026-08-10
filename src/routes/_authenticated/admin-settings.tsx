import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUserRole } from "@/hooks/use-auth";
import { BackupPanel } from "@/components/BackupPanel";
import { UpcomingChecksEmailPanel } from "@/components/UpcomingChecksEmailPanel";
import { SecurityAuditPanel } from "@/components/SecurityAuditPanel";
import { UsersPanel } from "@/routes/_authenticated/settings";
import { SecurityAccessPanel } from "@/components/SecurityAccessPanel";

export const Route = createFileRoute("/_authenticated/admin-settings")({
  head: () => ({
    meta: [
      { title: "הגדרות ניהול | מרכז קארלין סטאלין" },
      { name: "description", content: "מסך ניהול מתקדם: סנכרון, גיבוי, התראות מייל, אבטחה ומשתמשים." },
      { property: "og:title", content: "הגדרות ניהול | מרכז קארלין סטאלין" },
      { property: "og:description", content: "מסך ניהול מתקדם למנהלי-על בלבד." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  const { data: role, isLoading } = useUserRole();

  if (isLoading) {
    return (
      <AppShell title="הגדרות ניהול">
        <div className="p-8 text-center text-muted-foreground">טוען…</div>
      </AppShell>
    );
  }

  if (!role?.isSuperAdmin) {
    return (
      <AppShell title="הגדרות ניהול">
        <Card>
          <CardContent className="p-8 text-center">
            אין הרשאה לגשת לדף זה. מסך זה זמין למנהל-על בלבד.
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell title="הגדרות ניהול">
      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="users">משתמשים והרשאות</TabsTrigger>
          <TabsTrigger value="sheets">סנכרון גוגל שיטס</TabsTrigger>
          <TabsTrigger value="backup">גיבוי יומי</TabsTrigger>
          <TabsTrigger value="checks_email">מייל צ'קים</TabsTrigger>
          <TabsTrigger value="security_audit">סריקת אבטחה</TabsTrigger>
          <TabsTrigger value="access">אבטחה וגישה</TabsTrigger>
        </TabsList>
        <TabsContent value="users"><UsersPanel /></TabsContent>
        <TabsContent value="sheets"><SheetsSyncPanel /></TabsContent>
        <TabsContent value="backup"><BackupPanel /></TabsContent>
        <TabsContent value="checks_email"><UpcomingChecksEmailPanel /></TabsContent>
        <TabsContent value="security_audit"><SecurityAuditPanel /></TabsContent>
        <TabsContent value="access"><SecurityAccessPanel /></TabsContent>
      </Tabs>
    </AppShell>
  );
}
