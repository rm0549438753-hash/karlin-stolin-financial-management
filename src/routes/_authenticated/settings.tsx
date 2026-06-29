import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, UserPlus, Ban, ShieldCheck, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUserRole, useAuthUser } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminDeleteUser, adminSetUserBlocked, adminListUsers } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const { data: role, isLoading } = useUserRole();
  if (isLoading) return <AppShell title="הגדרות"><div className="p-8 text-center text-muted-foreground">טוען…</div></AppShell>;
  if (!role?.isAdmin && !role?.isEditor) {
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
          {role?.isAdmin && <TabsTrigger value="users">משתמשים והרשאות</TabsTrigger>}
        </TabsList>
        <TabsContent value="accounts"><LookupCRUD table="accounts" label="חשבונות" hasKind /></TabsContent>
        <TabsContent value="funds"><LookupCRUD table="funds" label="קופות" /></TabsContent>
        <TabsContent value="expense_types"><LookupCRUD table="expense_types" label="סוגי הוצאה" /></TabsContent>
        <TabsContent value="categories"><LookupCRUD table="categories" label="קטגוריות" /></TabsContent>
        <TabsContent value="subcategories"><LookupCRUD table="subcategories" label="תת-קטגוריות" hasCategory /></TabsContent>
        {role?.isAdmin && <TabsContent value="users"><UsersPanel /></TabsContent>}
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

  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [editName, setEditName] = useState("");

  const rename = useMutation({
    mutationFn: async () => {
      if (!editing || !editName.trim()) throw new Error("יש להזין שם");
      const { error } = await supabase.from(table as any).update({ name: editName.trim() }).eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("השם עודכן בכל המקומות במערכת");
      setEditing(null);
      // Invalidate everything that may reference these names
      qc.invalidateQueries({ queryKey: [table] });
      qc.invalidateQueries({ queryKey: [table, "all"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      qc.invalidateQueries({ queryKey: ["funds"] });
      qc.invalidateQueries({ queryKey: ["expense_types"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
      qc.invalidateQueries({ queryKey: ["subcategories"] });
    },
    onError: (e: any) => toast.error(e.message),
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
              <div className="flex items-center gap-1">
                <Button size="icon" variant="ghost" onClick={() => { setEditing({ id: r.id, name: r.name }); setEditName(r.name); }} title="עריכת שם">
                  <Pencil className="w-4 h-4" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(r.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
          {rows.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">רשימה ריקה</div>}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>עריכת שם</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 py-2">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") rename.mutate(); }}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                שינוי השם יתעדכן אוטומטית בכל התנועות והדוחות שמסווגים תחת פריט זה.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>ביטול</Button>
              <Button onClick={() => rename.mutate()} disabled={rename.isPending}>שמירה</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const { user: me } = useAuthUser();
  const createUser = useServerFn(adminCreateUser);
  const deleteUser = useServerFn(adminDeleteUser);
  const setBlocked = useServerFn(adminSetUserBlocked);
  const listUsers = useServerFn(adminListUsers);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "editor" | "viewer">("editor");

  const { data = [] } = useQuery({
    queryKey: ["users-with-roles"],
    queryFn: async () => await listUsers(),
  });


  const add = useMutation({
    mutationFn: async () => {
      if (!newEmail.trim() || newPassword.length < 6) throw new Error("יש למלא אימייל וסיסמה (6 תווים לפחות)");
      await createUser({ data: { email: newEmail.trim(), password: newPassword, fullName: newName.trim(), role: newRole } });
    },
    onSuccess: () => {
      toast.success("המשתמש נוצר");
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewRole("editor");
      qc.invalidateQueries({ queryKey: ["users-with-roles"] });
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה ביצירת משתמש"),
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "editor" }) => {
      await supabase.from("user_roles").delete().eq("user_id", userId);
      const { error } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("התפקיד עודכן"); qc.invalidateQueries({ queryKey: ["users-with-roles"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const block = useMutation({
    mutationFn: async ({ userId, blocked }: { userId: string; blocked: boolean }) => {
      await setBlocked({ data: { userId, blocked } });
    },
    onSuccess: (_d, v) => { toast.success(v.blocked ? "המשתמש נחסם" : "החסימה הוסרה"); qc.invalidateQueries({ queryKey: ["users-with-roles"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (userId: string) => { await deleteUser({ data: { userId } }); },
    onSuccess: () => { toast.success("המשתמש נמחק"); qc.invalidateQueries({ queryKey: ["users-with-roles"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader><CardTitle>משתמשים והרשאות</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
          <div className="text-sm font-medium">הוספת משתמש חדש</div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <Input placeholder="שם מלא" value={newName} onChange={(e) => setNewName(e.target.value)} />
            <Input placeholder="אימייל" type="email" dir="ltr" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <Input placeholder="סיסמה (6+)" type="text" dir="ltr" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">עורך</SelectItem>
                <SelectItem value="admin">מנהל</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => add.mutate()} disabled={add.isPending}>
              <UserPlus className="w-4 h-4 ml-1" />
              {add.isPending ? "יוצר..." : "צור משתמש"}
            </Button>
          </div>
          
        </div>

        <div className="border rounded-lg divide-y">
          {data.map((u: any) => {
            const current = u.roles.includes("admin") ? "admin" : "editor";
            const isMe = me?.id === u.id;
            return (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-2">
                    {u.full_name || u.email}
                    {u.blocked && <Badge variant="destructive" className="text-[10px]">חסום</Badge>}
                    {isMe && <Badge variant="outline" className="text-[10px]">אני</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={current} onValueChange={(v) => setRole.mutate({ userId: u.id, role: v as any })} disabled={isMe}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">מנהל</SelectItem>
                      <SelectItem value="editor">עורך</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isMe || block.isPending}
                    onClick={() => block.mutate({ userId: u.id, blocked: !u.blocked })}
                  >
                    {u.blocked ? <ShieldCheck className="w-4 h-4 ml-1" /> : <Ban className="w-4 h-4 ml-1" />}
                    {u.blocked ? "שחרור" : "חסום"}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" className="text-destructive" disabled={isMe} title="מחיקה">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent dir="rtl">
                      <AlertDialogHeader>
                        <AlertDialogTitle>למחוק את המשתמש?</AlertDialogTitle>
                        <AlertDialogDescription>
                          {u.full_name || u.email} יוסר לצמיתות מהמערכת. פעולה זו אינה הפיכה.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>ביטול</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(u.id)} className="bg-destructive text-destructive-foreground">
                          מחיקה
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>

            );
          })}
          {data.length === 0 && <div className="p-4 text-center text-sm text-muted-foreground">אין משתמשים</div>}
        </div>
        
      </CardContent>
    </Card>
  );
}
