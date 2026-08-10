import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const NONE = "__none__";

/** Compact inline select used in table rows for quick classification editing. */
export function QuickEditCell({
  value, items, placeholder = "— ללא —", onChange, disabled,
}: {
  value: string | null | undefined;
  items: { id: string; name: string }[];
  placeholder?: string;
  onChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <Select
      value={value ?? NONE}
      onValueChange={(v) => onChange(v === NONE ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger
        className="h-6 min-h-0 w-full max-w-[110px] border-none bg-transparent px-1 py-0 text-[11px] shadow-none hover:bg-muted focus:ring-1 focus:ring-ring [&>svg]:h-3 [&>svg]:w-3"
        onClick={(e) => e.stopPropagation()}
      >
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
