import { createFileRoute } from "@tanstack/react-router";
import { createContext, useContext, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trash2, Plus, UserPlus, Ban, ShieldCheck, Pencil, EyeOff, X } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useUserRole, useAuthUser } from "@/hooks/use-auth";
import { useServerFn } from "@tanstack/react-start";
import { adminCreateUser, adminDeleteUser, adminSetUserBlocked, adminListUsers } from "@/lib/admin-users.functions";
import { syncFromGoogleSheet, listSyncIgnores, addSyncIgnores, removeSyncIgnore } from "@/lib/sheets-sync.functions";



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
          {role?.isAdmin && <TabsTrigger value="sheets">סנכרון גוגל שיטס</TabsTrigger>}
          {role?.isAdmin && <TabsTrigger value="users">משתמשים והרשאות</TabsTrigger>}
        </TabsList>
        <TabsContent value="accounts"><LookupCRUD table="accounts" label="חשבונות" hasKind /></TabsContent>
        <TabsContent value="funds"><LookupCRUD table="funds" label="קופות" /></TabsContent>
        <TabsContent value="expense_types"><LookupCRUD table="expense_types" label="סוגי הוצאה" /></TabsContent>
        <TabsContent value="categories"><LookupCRUD table="categories" label="קטגוריות" /></TabsContent>
        <TabsContent value="subcategories"><LookupCRUD table="subcategories" label="תת-קטגוריות" hasCategory /></TabsContent>
        {role?.isAdmin && <TabsContent value="sheets"><SheetsSyncPanel /></TabsContent>}
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
    mutationFn: async ({ userId, role }: { userId: string; role: "admin" | "editor" | "viewer" }) => {
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
                <SelectItem value="viewer">צופה (קריאה בלבד)</SelectItem>
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
            const current = u.roles.includes("admin") ? "admin" : u.roles.includes("editor") ? "editor" : "viewer";
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
                    <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">מנהל</SelectItem>
                      <SelectItem value="editor">עורך</SelectItem>
                      <SelectItem value="viewer">צופה</SelectItem>
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

type ExclKey = string; // `${accountId}::${kind}::${id}`
type Kind = "insert" | "update" | "review";
type ExclusionCtx = {
  isMarked: (accountId: string, kind: Kind, id: string) => boolean;
  toggle: (accountId: string, kind: Kind, id: string) => void;
  setBulk: (accountId: string, kind: Kind, ids: string[], marked: boolean) => void;
  ignoreForever: (items: { kind: "account" | "insert" | "review"; accountId: string; refKey?: string }[]) => void;
};
const ExclusionContext = createContext<ExclusionCtx | null>(null);
const useExcl = () => useContext(ExclusionContext)!;
const eKey = (a: string, k: Kind, id: string): ExclKey => `${a}::${k}::${id}`;


function SheetsSyncPanel() {
  const qc = useQueryClient();
  const [sheetUrl, setSheetUrl] = useState("https://docs.google.com/spreadsheets/d/1dJUbkiRRwVbEozEwpD_KCgh8ur9BclFoxmYjRP2q8fs/edit");
  const [preview, setPreview] = useState<any>(null);
  const [marked, setMarked] = useState<Set<ExclKey>>(new Set());
  const syncFn = useServerFn(syncFromGoogleSheet);
  const listIgnoresFn = useServerFn(listSyncIgnores);
  const addIgnoresFn = useServerFn(addSyncIgnores);
  const removeIgnoreFn = useServerFn(removeSyncIgnore);

  const { data: ignores = [] } = useQuery({
    queryKey: ["sync-ignores"],
    queryFn: async () => await listIgnoresFn(),
  });

  const { data: accountsList = [] } = useQuery({
    queryKey: ["accounts", "for-ignores"],
    queryFn: async () => (await supabase.from("accounts").select("id,name").order("name")).data ?? [],
  });
  const accountName = (id: string) => (accountsList as any[]).find((a) => a.id === id)?.name ?? id;

  function extractId(u: string): string | null {
    const m = u.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return m ? m[1] : u.trim() || null;
  }





  function buildExclusionsPayload(): Record<string, { insertIds: string[]; updatePairIds: string[]; reviewDeleteIds: string[] }> {
    const out: Record<string, { insertIds: string[]; updatePairIds: string[]; reviewDeleteIds: string[] }> = {};
    for (const key of marked) {
      const [a, k, id] = key.split("::");
      if (!out[a]) out[a] = { insertIds: [], updatePairIds: [], reviewDeleteIds: [] };
      if (k === "insert") out[a].insertIds.push(id);
      else if (k === "update") out[a].updatePairIds.push(id);
      else if (k === "review") out[a].reviewDeleteIds.push(id);
    }
    return out;
  }

  async function runPreview() {
    const id = extractId(sheetUrl);
    if (!id) throw new Error("קישור לא תקין");
    return await syncFn({ data: { spreadsheetId: id, apply: false } });
  }

  const previewMut = useMutation({
    mutationFn: runPreview,
    onSuccess: (r) => { setPreview(r); setMarked(new Set()); toast.success("הצצה מוכנה"); },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  const applyMut = useMutation({
    mutationFn: async () => {
      const id = extractId(sheetUrl);
      if (!id) throw new Error("קישור לא תקין");
      return await syncFn({ data: { spreadsheetId: id, apply: true, exclusions: buildExclusionsPayload() } });
    },
    onSuccess: async (r) => {
      toast.success(`סונכרן: ${r.totalInserted} נוספו · ${r.totalUpdated} עודכנו · ${r.totalDeleted} נמחקו`);
      setMarked(new Set());
      qc.invalidateQueries();
      // Auto-refresh the preview so the user sees the updated state
      try {
        const fresh = await runPreview();
        setPreview(fresh);
      } catch (e: any) {
        setPreview(r);
      }
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאת סנכרון"),
  });

  const addIgnoresMut = useMutation({
    mutationFn: async (items: { kind: "account" | "insert" | "review"; accountId: string; refKey?: string; note?: string }[]) => {
      await addIgnoresFn({ data: { items } });
    },
    onSuccess: async (_d, items) => {
      toast.success(items.length === 1 ? "נוסף לרשימת מוסתרים" : `${items.length} פריטים הוסתרו`);
      await qc.invalidateQueries({ queryKey: ["sync-ignores"] });
      // Refresh preview so hidden items disappear immediately
      if (preview) {
        try {
          const fresh = await runPreview();
          setPreview(fresh);
        } catch {}
      }
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  const removeIgnoreMut = useMutation({
    mutationFn: async (id: string) => { await removeIgnoreFn({ data: { id } }); },
    onSuccess: async () => {
      toast.success("הוסר מרשימת מוסתרים");
      await qc.invalidateQueries({ queryKey: ["sync-ignores"] });
      if (preview) {
        try {
          const fresh = await runPreview();
          setPreview(fresh);
        } catch {}
      }
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה"),
  });

  const exclCtx: ExclusionCtx = useMemo(() => ({
    isMarked: (a, k, id) => marked.has(eKey(a, k, id)),
    toggle: (a, k, id) => setMarked((prev) => {
      const next = new Set(prev);
      const key = eKey(a, k, id);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    }),
    setBulk: (a, k, ids, mark) => setMarked((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        const key = eKey(a, k, id);
        if (mark) next.add(key); else next.delete(key);
      }
      return next;
    }),
    ignoreForever: (items) => addIgnoresMut.mutate(items),
  }), [marked, addIgnoresMut]);


  // Counters (accounting for user selections)
  const counts = useMemo(() => {
    if (!preview) return { insert: 0, update: 0, delete: 0 };
    let ins = 0, upd = 0, del = 0;
    for (const p of preview.perAccount) {
      ins += p.inserts.filter((r: any) => !marked.has(eKey(p.accountId, "insert", r.id))).length;
      upd += p.updates.filter((u: any) => !marked.has(eKey(p.accountId, "update", u.sheet.id))).length;
      del += p.reviewRows.filter((r: any) => marked.has(eKey(p.accountId, "review", r.id))).length;
    }
    return { insert: ins, update: upd, delete: del };
  }, [preview, marked]);

  return (
    <ExclusionContext.Provider value={exclCtx}>
      <Card>
        <CardHeader>
          <CardTitle>סנכרון תנועות מגוגל שיטס</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input dir="ltr" value={sheetUrl} onChange={(e) => setSheetUrl(e.target.value)} placeholder="Google Sheets URL" />
            <Button variant="outline" disabled={previewMut.isPending} onClick={() => previewMut.mutate()}>
              {previewMut.isPending ? "בודק…" : "הצצה"}
            </Button>
            <Button disabled={applyMut.isPending || !preview} onClick={() => applyMut.mutate()}>
              {applyMut.isPending
                ? "מסנכרן…"
                : `סנכרן (+${counts.insert} · ~${counts.update} · −${counts.delete})`}
            </Button>
          </div>

          {preview && (
            <div className="border rounded-xl overflow-hidden">
              <div className="grid grid-cols-[1fr_90px_90px_90px_90px] gap-2 p-3 bg-muted/50 font-medium text-sm">
                <div>חשבון</div>
                <div className="text-center text-green-700">להוספה</div>
                <div className="text-center text-amber-700">לעדכון</div>
                <div className="text-center text-slate-700">לבדיקה</div>
                <div className="text-center text-muted-foreground">ללא שינוי</div>
              </div>
              {preview.perAccount.map((p: any) => (
                <AccountDiffRow key={p.accountId} p={p} spreadsheetId={preview.spreadsheetId} />
              ))}
              <div className="grid grid-cols-[1fr_90px_90px_90px_90px] gap-2 p-3 border-t bg-muted/30 text-sm font-bold">
                <div>סה״כ</div>
                <div className="text-center text-green-700">{preview.perAccount.reduce((a: number, x: any) => a + x.toInsert, 0)}</div>
                <div className="text-center text-amber-700">{preview.perAccount.reduce((a: number, x: any) => a + x.toUpdate, 0)}</div>
                <div className="text-center text-slate-700">{preview.perAccount.reduce((a: number, x: any) => a + x.review, 0)}</div>
                <div className="text-center">—</div>
              </div>
              {preview.skippedSheets?.length > 0 && (
                <div className="p-3 border-t text-xs text-muted-foreground">
                  גיליונות שדולגו (אין להם חשבון תואם): {preview.skippedSheets.join(", ")}
                </div>
              )}
            </div>
          )}

          {(ignores as any[]).length > 0 && (
            <details className="border rounded-lg bg-muted/20">
              <summary className="cursor-pointer select-none p-3 text-sm font-medium">
                פריטים מוסתרים מהסנכרון ({(ignores as any[]).length}) — לחץ להצגה
              </summary>
              <div className="divide-y">
                {(ignores as any[]).map((ig) => (
                  <div key={ig.id} className="flex items-center justify-between p-2 text-xs">
                    <div className="min-w-0 truncate">
                      <span className="font-medium">
                        {ig.kind === "account" ? "חשבון מלא" : ig.kind === "insert" ? "תנועה בגיליון" : "תנועה בממשק"}
                      </span>
                      <span className="text-muted-foreground"> · {accountName(ig.account_id)}</span>
                      {ig.ref_key && ig.kind !== "account" && (
                        <span className="text-muted-foreground truncate mr-2" dir="ltr"> · {ig.ref_key}</span>
                      )}
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => removeIgnoreMut.mutate(ig.id)} disabled={removeIgnoreMut.isPending}>
                      <X className="w-3 h-3 ml-1" />הסר
                    </Button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </CardContent>
      </Card>
    </ExclusionContext.Provider>
  );
}


const FIELD_LABELS: Record<string, string> = {
  transaction_date: "תאריך",
  value_date: "תאריך ערך",
  description: "תיאור",
  reference: "אסמכתא/צ׳ק",
  payee: "שם / מוטב",
  note: "הערה",
  credit: "זכות",
  debit: "חובה",
  amount: "סכום",
  balance: "יתרה",
  fee: "עמלה",
  fund_name: "קופה",
  expense_type_name: "סוג",
  category_name: "קטגוריה",
  subcategory_name: "תת-קטגוריה",
};
const FIELD_ORDER = Object.keys(FIELD_LABELS);
const NUMERIC_FIELDS = new Set(["credit", "debit", "amount", "balance", "fee"]);
const CLASS_FIELDS = new Set(["fund_name", "expense_type_name", "category_name", "subcategory_name"]);

function fmtVal(field: string, v: any): string {
  if (v == null || v === "") return "—";
  if (NUMERIC_FIELDS.has(field)) return Number(v).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(v);
}
function normCompare(field: string, v: any): string {
  if (v == null || v === "") return "";
  if (NUMERIC_FIELDS.has(field)) return Number(v).toFixed(2);
  return String(v).trim().replace(/\s+/g, " ");
}

function BulkToggle({ accountId, kind, ids, label }: { accountId: string; kind: Kind; ids: string[]; label?: [string, string] }) {
  const { isMarked, setBulk } = useExcl();
  const allMarked = ids.length > 0 && ids.every((id) => isMarked(accountId, kind, id));
  const [markLabel, unmarkLabel] = label ?? ["הסר הכל", "החזר הכל"];
  return (
    <button
      type="button"
      onClick={() => setBulk(accountId, kind, ids, !allMarked)}
      className="text-[11px] text-muted-foreground underline hover:text-foreground"
    >
      {allMarked ? unmarkLabel : markLabel}
    </button>
  );
}

function sheetUrl(spreadsheetId: string | undefined, gid: number | null | undefined, rowIndex?: number | null) {
  if (!spreadsheetId) return null;
  const base = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  const g = gid != null ? `gid=${gid}` : "";
  const r = rowIndex ? `&range=A${rowIndex}` : "";
  return `${base}#${g}${r}`;
}
function txUrl(accountId: string, txId: string) {
  return `/transactions?account=${encodeURIComponent(accountId)}&highlight=${encodeURIComponent(txId)}`;
}

function AccountDiffRow({ p, spreadsheetId }: { p: any; spreadsheetId?: string }) {
  const [open, setOpen] = useState(false);
  const { ignoreForever } = useExcl();
  const hasChanges = p.toInsert > 0 || p.toUpdate > 0 || p.review > 0;
  return (
    <>
      <div
        onClick={() => hasChanges && setOpen((v) => !v)}
        className={`w-full grid grid-cols-[1fr_90px_90px_90px_90px] gap-2 p-3 border-t text-sm text-right ${hasChanges ? "hover:bg-muted/40 cursor-pointer" : "cursor-default"}`}
      >
        <div className="truncate flex items-center gap-2">
          {hasChanges && <span className="text-xs">{open ? "▾" : "▸"}</span>}
          <span>{p.accountName}</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`להסתיר את החשבון "${p.accountName}" מכל סנכרון עתידי?`)) {
                ignoreForever([{ kind: "account", accountId: p.accountId }]);
              }
            }}
            title="הסתר חשבון זה מכל סנכרון עתידי"
            className="text-[11px] text-muted-foreground hover:text-destructive underline"
          >
            <EyeOff className="w-3 h-3 inline ml-1" />הסתר תמיד
          </button>
        </div>
        <div className="text-center text-green-700 font-semibold">{p.toInsert}</div>
        <div className="text-center text-amber-700 font-semibold">{p.toUpdate}</div>
        <div className="text-center text-slate-700 font-semibold">{p.review}</div>
        <div className="text-center text-muted-foreground">{p.unchanged}</div>
      </div>

      {open && hasChanges && (
        <div className="border-t bg-muted/20 p-3 space-y-4">
          {p.updates?.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-amber-700 mb-1 flex items-center justify-between">
                <span>לעדכון ({p.updates.length}) — סיווג בלבד, ללא מחיקה</span>
                <BulkToggle accountId={p.accountId} kind="update" ids={p.updates.map((u: any) => u.sheet.id)} />
              </div>
              <div className="space-y-2">
                {p.updates.map((pair: any) => (
                  <UpdatePairCard key={pair.sheet.id} pair={pair} accountId={p.accountId} spreadsheetId={spreadsheetId} sheetGid={p.sheetGid} />
                ))}
              </div>
            </section>
          )}
          {p.inserts?.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-green-700 mb-1 flex items-center justify-between">
                <span>להוספה ({p.inserts.length})</span>
                <BulkToggle accountId={p.accountId} kind="insert" ids={p.inserts.map((r: any) => r.id)} />
              </div>
              <FullRowsTable rows={p.inserts} accountId={p.accountId} kind="insert" defaultChecked source="sheet" spreadsheetId={spreadsheetId} sheetGid={p.sheetGid} />
            </section>
          )}
          {p.reviewRows?.length > 0 && (
            <section>
              <div className="text-xs font-semibold text-slate-700 mb-1 flex items-center justify-between">
                <span>לבדיקה ({p.reviewRows.length}) — קיימות רק בממשק. סמן רק את מה שברצונך למחוק.</span>
                <BulkToggle accountId={p.accountId} kind="review" ids={p.reviewRows.map((r: any) => r.id)} label={["סמן הכל למחיקה", "בטל סימון"]} />
              </div>
              <FullRowsTable rows={p.reviewRows} accountId={p.accountId} kind="review" defaultChecked={false} source="db" />
            </section>
          )}
        </div>
      )}
    </>
  );
}

function UpdatePairCard({ pair, accountId, spreadsheetId, sheetGid }: { pair: { sheet: any; db: any; dbId: string }; accountId: string; spreadsheetId?: string; sheetGid?: number | null }) {
  const { isMarked, toggle } = useExcl();
  const excluded = isMarked(accountId, "update", pair.sheet.id);
  const diffFields = Array.from(CLASS_FIELDS).filter(
    (f) => normCompare(f, pair.sheet[f]) !== normCompare(f, pair.db[f]),
  );
  const contextFields = ["transaction_date", "value_date", "reference", "amount", "description", "payee"];
  const appHref = txUrl(accountId, pair.dbId);
  const sheetHref = sheetUrl(spreadsheetId, sheetGid, pair.sheet.sheetRowIndex);
  return (
    <div className={`rounded border bg-background p-2 text-xs ${excluded ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-2 mb-1 justify-between">
        <label className="flex items-center gap-2 cursor-pointer">
          <Checkbox checked={!excluded} onCheckedChange={() => toggle(accountId, "update", pair.sheet.id)} />
          <span className="text-[11px] text-muted-foreground">{excluded ? "לא ייכלל בסנכרון" : "כלול בעדכון"}</span>
        </label>
        <div className="text-[11px] text-muted-foreground">
          {contextFields.map((f) => pair.db[f] ? `${FIELD_LABELS[f]}: ${fmtVal(f, pair.db[f])}` : null).filter(Boolean).join(" · ")}
        </div>
      </div>
      <div className="grid grid-cols-[100px_1fr_1fr] gap-2 font-medium text-muted-foreground border-b pb-1 mb-1">
        <div>שדה</div>
        <div>
          בממשק (נוכחי){" "}
          <a href={appHref} target="_blank" rel="noreferrer" className="text-primary underline text-[10px]">פתח</a>
        </div>
        <div>
          בגיליון (חדש){" "}
          {sheetHref && <a href={sheetHref} target="_blank" rel="noreferrer" className="text-primary underline text-[10px]">פתח</a>}
        </div>
      </div>
      {Array.from(CLASS_FIELDS).map((f) => {
        const changed = diffFields.includes(f);
        const before = fmtVal(f, pair.db[f]);
        const after = fmtVal(f, pair.sheet[f]);
        return (
          <div key={f} className={`grid grid-cols-[100px_1fr_1fr] gap-2 py-0.5 ${changed ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}>
            <div className="text-muted-foreground">{FIELD_LABELS[f]}</div>
            <div className={changed ? "text-red-700 font-medium line-through decoration-red-400/60" : ""}>{before}</div>
            <div className={changed ? "text-green-700 font-medium" : ""}>{after}</div>
          </div>
        );
      })}
    </div>
  );
}

function FullRowsTable({ rows, accountId, kind, defaultChecked, source, spreadsheetId, sheetGid }: { rows: any[]; accountId: string; kind: Kind; defaultChecked: boolean; source?: "sheet" | "db"; spreadsheetId?: string; sheetGid?: number | null }) {
  const { isMarked, toggle, ignoreForever } = useExcl();
  return (
    <div className="rounded border bg-background max-h-80 overflow-auto text-xs">
      <div
        className="grid gap-2 px-2 py-1 bg-muted/40 font-medium sticky top-0"
        style={{ gridTemplateColumns: `28px 40px 50px repeat(${FIELD_ORDER.length}, minmax(80px, 1fr))` }}
      >
        <div></div>
        <div></div>
        <div></div>
        {FIELD_ORDER.map((f) => <div key={f} className="truncate">{FIELD_LABELS[f]}</div>)}
      </div>
      {rows.map((r) => {
        const marked = isMarked(accountId, kind, r.id);
        const checked = defaultChecked ? !marked : marked;
        const rowClass = defaultChecked
          ? (marked ? "opacity-50 bg-muted/30" : "")
          : (marked ? "bg-red-50 dark:bg-red-950/20" : "");
        const href = source === "db"
          ? txUrl(accountId, r.id)
          : sheetUrl(spreadsheetId, sheetGid, r.sheetRowIndex);
        return (
          <div
            key={r.id}
            className={`grid gap-2 px-2 py-1 border-t items-center ${rowClass}`}
            style={{ gridTemplateColumns: `28px 40px 50px repeat(${FIELD_ORDER.length}, minmax(80px, 1fr))` }}
          >
            <div>
              <Checkbox checked={checked} onCheckedChange={() => toggle(accountId, kind, r.id)} />
            </div>
            <div>
              {href ? (
                <a href={href} target="_blank" rel="noreferrer" className="text-primary underline text-[10px]" title={source === "db" ? "פתח בממשק" : "פתח בגיליון"}>פתח</a>
              ) : null}
            </div>
            <div>
              <button
                type="button"
                onClick={() => ignoreForever([{ kind: kind === "update" ? "insert" : kind, accountId, refKey: r.id }])}
                title="הסתר תנועה זו מכל סנכרון עתידי"
                className="text-[10px] text-muted-foreground hover:text-destructive underline"
              >
                <EyeOff className="w-3 h-3 inline" />
              </button>
            </div>
            {FIELD_ORDER.map((f) => (
              <div key={f} className={`truncate ${NUMERIC_FIELDS.has(f) ? "tabular-nums text-left" : ""}`} title={fmtVal(f, r[f])}>
                {fmtVal(f, r[f])}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}




