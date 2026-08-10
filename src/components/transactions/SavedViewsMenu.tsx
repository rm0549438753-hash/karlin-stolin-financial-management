import { useState } from "react";
import { BookmarkPlus, Bookmark, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { useSavedViews, type TxFilters } from "@/hooks/use-saved-filters";

/** "תצוגות מועדפות" — save, pick and delete named filter presets per account. */
export function SavedViewsMenu({
  accountId, currentFilters, onApply,
}: {
  accountId: string;
  currentFilters: TxFilters;
  onApply: (filters: TxFilters) => void;
}) {
  const { views, save, remove } = useSavedViews(accountId);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { toast.error("יש להזין שם לתצוגה"); return; }
    save(trimmed, currentFilters);
    setName("");
    toast.success("התצוגה נשמרה");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Bookmark className="w-3.5 h-3.5" />תצוגות מועדפות
        </Button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" className="w-72 p-3">
        <div className="text-sm font-semibold mb-2">תצוגות מועדפות</div>
        {views.length === 0 ? (
          <div className="text-xs text-muted-foreground mb-3">אין תצוגות שמורות עבור חשבון זה</div>
        ) : (
          <ul className="mb-3 max-h-48 overflow-auto divide-y">
            {views.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2 py-1.5">
                <button
                  className="text-sm truncate flex-1 text-right hover:underline"
                  onClick={() => { onApply(v.filters); setOpen(false); toast.success(`התצוגה "${v.name}" הוחלה`); }}
                >
                  {v.name}
                </button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive shrink-0" onClick={() => remove(v.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 border-t pt-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="שם התצוגה החדשה" className="h-8 text-sm" />
          <Button size="sm" className="h-8 shrink-0 gap-1" onClick={handleSave}>
            <BookmarkPlus className="w-3.5 h-3.5" />שמירה
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
