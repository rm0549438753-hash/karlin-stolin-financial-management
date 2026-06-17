import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useUserRole } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: role, isLoading } = useUserRole();
  if (isLoading) return <AppShell title="הגדרות"><div className="p-8 text-center text-muted-foreground">טוען…</div></AppShell>;
  if (!role?.isAdmin) {
    return <AppShell title="הגדרות"><Card><CardContent className="p-8 text-center">אין הרשאה לגשת לדף זה.</CardContent></Card></AppShell>;
  }
  return (
    <AppShell title="הגדרות">
      <Tabs defaultValue="accounts" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="accounts">חשבונות</TabsTrigger>
          <TabsTrigger value="funds">קופות</TabsTrigger>
          <TabsTrigger value="expense_types">סוגי הוצאה</TabsTrigger>
          <TabsTrigger value="categories">קטגוריות</TabsTrigger>
          <TabsTrigger value="subcategories">תת-קטגוריות</TabsTrigger>
          <TabsTrigger value="users">משתמשים והרשאות</TabsTrigger>
        </TabsList>
        <TabsContent value="accounts"><LookupCRUD table="accounts" label="חשבונות" hasKind /></TabsContent>
        <TabsContent value="funds"><LookupCRUD table="funds" label="קופות" /></TabsContent>
        <TabsContent value="expense_types"><LookupCRUD table="expense_types" label="סוגי הוצאה" /></TabsContent>
        <TabsContent value="categories"><LookupCRUD table="categories" label="קטגוריות" /></TabsContent>
        <TabsContent value="subcategories"><LookupCRUD table="subcategories" label="תת-קטגוריות" hasCategory /></TabsContent>
        <TabsContent value="users"><UsersPanel /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

function LookupCRUD({ table, label, hasKind, hasCategory }: { table: string; label: string; hasKind?: boolean; hasCategory?: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [kind, setKind] = useState("bank");
  const [catId, setCatId] = useState<string>("");

  const { data: rows = [] } = useQuery({
    queryKey: [table, "all"],
    queryFn: async () => {
      const { data } = await supabase.from(table as any).select("*").order("name");
      return data ?? [];
    },
  });
  const { data: cats = [] } = useQuery({
    queryKey: ["categories", "all"],
    queryFn: async () => (await supabase.from("categories").select("id,name").order("name")).data ?? [],
    enabled: !!hasCategory,
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("יש להזין שם");
      const payload: any = { name: name.trim() };
      if (hasKind) payload.kind = kind;
      if (hasCategory && catId) payload.category_id = catId;
      const { error } = await supabase.from(table as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("נוסף"); setName(""); qc.invalidateQueries({ queryKey: [table] }); qc.invalidateQueries({ queryKey: [table, "all"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(table as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("נמחק"); qc.invalidateQueries({ queryKey: [table] }); qc.invalidateQueries({ queryKey: [table, "all"] }); },
    onError: (e: any) => toast.error(e.message ?? "לא ניתן למחוק (יתכן ויש בו שימוש)"),
  });

  return (
    <Card>
      <CardHeader><CardTitle>{label}</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`שם ${label}`} className="max-w-xs" />
          {hasKind && (
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bank">בנק</SelectItem>
                <SelectItem value="cash">מזומן</SelectItem>
                <SelectItem value="checks">צ'קים</SelectItem>
              </SelectContent>
            </Select>
          )}
          {hasCategory && (
            <Select value={catId} onValueChange={setCatId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="קטגוריית-אב (אופציונלי)" /></SelectTrigger>
              <SelectContent>
                {(cats as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => add.mutate()} disabled={add.isPending}><Plus className="w-4 h-4 ml-1" />הוסף</Button>
        </div>
        <div className="border rounded-lg divide-y max-h-[60vh] overflow-y-auto">
          {(rows as any[]).map((r) => (
            <div key={r.id} className="flex items-center justify-between p-2 hover:bg-muted/50">
              <span>{r.name}{hasKind && <span className="text-xs text-muted-foreground mr-2">({r.kind})</span>}</span>
              <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}>
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          {rows.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">רשימה ריקה</div>}
        </div>
      </CardContent>
    </Card>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const { data: profiles } = await supabase.from("profiles").select("id, email, full_name");
      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const rolesByUser = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role);
        rolesByUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "editor" }) => {
      // Remove existing then insert single
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("התפקיד עודכן"); qc.invalidateQueries({ queryKey: ["users-with-roles"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>משתמשים והרשאות</CardTitle></CardHeader>
      <CardContent>
        <div className="border rounded-lg divide-y">
          {data.map((u: any) => {
            const current = u.roles.includes("admin") ? "admin" : "editor";
            return (
              <div key={u.id} className="flex items-center justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="font-medium truncate">{u.full_name || u.email}</div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <Select value={current} onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as any })}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">מנהל</SelectItem>
                    <SelectItem value="editor">עורך</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          })}
          {data.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">אין משתמשים</div>}
        </div>
        <p className="text-xs text-muted-foreground mt-3">משתמשים חדשים נוצרים כעורכים. ניתן לקדם למנהל כאן.</p>
      </CardContent>
    </Card>
  );
}
