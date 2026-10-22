import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";
const TRIGGER_CLS =
  "h-6 min-h-0 w-full max-w-[110px] border-none bg-transparent px-1 py-0 text-[11px] shadow-none hover:bg-muted focus:ring-1 focus:ring-ring [&>svg]:h-3 [&>svg]:w-3";

/**
 * Compact inline select used in table rows for quick classification editing.
 * Until clicked it renders only the current name: a full dropdown with every
 * option per cell made long tables very slow to draw.
 */
export function QuickEditCell({
  value, items, placeholder = "— ללא —", onChange, disabled,
}: {
  value: string | null | undefined;
  items: { id: string; name: string }[];
  placeholder?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const [active, setActive] = useState(false);

  if (!active) {
    const name = value ? items.find((i) => i.id === value)?.name : undefined;
    return (
      <button
        type="button"
        disabled={disabled}
        className={"flex items-center justify-between gap-1 rounded-md text-right " + TRIGGER_CLS + (name ? "" : " text-muted-foreground")}
        onClick={(e) => { e.stopPropagation(); setActive(true); }}
      >
        <span className="truncate">{name ?? placeholder}</span>
        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </button>
    );
  }

  return (
    <Select
      defaultOpen
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      onOpenChange={(o) => { if (!o) setActive(false); }}
      disabled={disabled}
    >
      <SelectTrigger className={TRIGGER_CLS} onClick={(e) => e.stopPropagation()}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        <SelectItem value={NONE}>— ללא —</SelectItem>
        {items.map((i) => (
          <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
