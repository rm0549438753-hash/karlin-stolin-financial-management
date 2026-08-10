import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const SHORTCUTS: { keys: string; desc: string }[] = [
  { keys: "Ctrl/⌘ + K", desc: "פתיחת חיפוש גלובלי" },
  { keys: "/", desc: "פתיחת חיפוש גלובלי" },
  { keys: "N", desc: "תנועה חדשה" },
  { keys: "Ctrl/⌘ + S", desc: "שמירת הדיאלוג הפתוח" },
  { keys: "Esc", desc: "סגירת הדיאלוג הפתוח" },
  { keys: "↑ / ↓", desc: "מעבר בין שורות בטבלה" },
  { keys: "Enter", desc: "פתיחת השורה המסומנת לעריכה" },
];

export function ShortcutsHelp() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" title="קיצורי מקלדת" className="gap-1.5">
          <Keyboard className="w-4 h-4" />
          <span className="hidden md:inline text-xs">קיצורי מקלדת</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent dir="rtl" className="w-72 p-3">
        <div className="text-sm font-semibold mb-2">קיצורי מקלדת</div>
        <ul className="space-y-1.5">
          {SHORTCUTS.map((s) => (
            <li key={s.keys} className="flex items-center justify-between gap-3 text-xs">
              <span className="text-muted-foreground">{s.desc}</span>
              <kbd className="bg-muted px-1.5 py-0.5 rounded font-mono text-[11px] whitespace-nowrap">{s.keys}</kbd>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
