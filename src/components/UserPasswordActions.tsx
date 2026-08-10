import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { KeyRound, Eye, EyeOff, Wand2, Mail, LogOut } from "lucide-react";
import { adminSetUserPassword, adminSendPasswordReset, adminSignOutUser } from "@/lib/admin-users.functions";

function generatePassword(): string {
  const chars = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const arr = new Uint32Array(14);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

export function UserPasswordActions({
  userId,
  email,
  canManage,
}: {
  userId: string;
  email: string;
  canManage: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const setPassword = useServerFn(adminSetUserPassword);
  const sendReset = useServerFn(adminSendPasswordReset);
  const signOutUser = useServerFn(adminSignOutUser);

  const save = useMutation({
    mutationFn: async () => await setPassword({ data: { userId, password: pw } }),
    onSuccess: () => {
      toast.success("הסיסמה עודכנה");
      setPw("");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message ?? "שגיאה בעדכון הסיסמה"),
  });

  const reset = useMutation({
    mutationFn: async () =>
      await sendReset({ data: { email, redirectTo: `${window.location.origin}/auth` } }),
    onSuccess: () => toast.success("נשלח קישור לאיפוס סיסמה"),
    onError: (e: any) => toast.error(e.message ?? "שגיאה בשליחת הקישור"),
  });

  const kick = useMutation({
    mutationFn: async () => await signOutUser({ data: { userId } }),
    onSuccess: () => toast.success("המשתמש נותק מכל המכשירים"),
    onError: (e: any) => toast.error(e.message ?? "שגיאה בניתוק"),
  });

  if (!canManage) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" title="ניהול סיסמה">
          <KeyRound className="w-4 h-4 ml-1" />
          סיסמה
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>ניהול סיסמה — {email}</DialogTitle>
          <DialogDescription>
            הסיסמאות נשמרות מוצפנות ואינן ניתנות לצפייה. ניתן לקבוע סיסמה חדשה או לשלוח קישור איפוס.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>סיסמה חדשה (10 תווים לפחות)</Label>
            <div className="flex gap-2">
              <Input
                dir="ltr"
                type={show ? "text" : "password"}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                placeholder="••••••••••"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setShow((s) => !s)} title="הצג/הסתר">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="יצירת סיסמה חזקה"
                onClick={() => {
                  setPw(generatePassword());
                  setShow(true);
                }}
              >
                <Wand2 className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => reset.mutate()} disabled={reset.isPending}>
              <Mail className="w-4 h-4 ml-1" />
              שלח קישור איפוס
            </Button>
            <Button variant="outline" onClick={() => kick.mutate()} disabled={kick.isPending}>
              <LogOut className="w-4 h-4 ml-1" />
              נתק מכל המכשירים
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={pw.length < 10 || save.isPending}>
            {save.isPending ? "שומר..." : "שמור סיסמה"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
