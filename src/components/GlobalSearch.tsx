import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { useAccounts } from "@/hooks/use-lookups";
import { formatCurrency, formatDate } from "@/lib/format";

type Hit = {
  id: string;
  transaction_date: string;
  amount: number;
  account_id: string;
  description: string | null;
  note: string | null;
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data: accounts = [] } = useAccounts();
  const acctMap = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inField = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "/" && !inField) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key.toLowerCase() === "n" && !inField && !e.ctrlKey && !e.metaKey && !e.altKey) {
        window.dispatchEvent(new CustomEvent("lovable:new-tx"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: hits = [], isFetching } = useQuery({
    queryKey: ["global-search", q],
    enabled: open && q.trim().length >= 2,
    queryFn: async () => {
      const term = q.trim();
      const asNum = Number(term.replace(/[,\s]/g, ""));
      // PostgREST uses commas/parens as delimiters in .or() and treats * as wildcard.
      // Wrap the value in double quotes and escape embedded quotes/backslashes so
      // punctuation (commas, parens, dots) inside the term doesn't break the filter.
      const safe = `"${term.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
      let query = supabase
        .from("transactions")
        .select("id, transaction_date, amount, account_id, description, note, payee")
        .order("transaction_date", { ascending: false })
        .limit(50);
      if (!isNaN(asNum) && asNum !== 0) {
        query = query.or(`description.ilike.%${safe}%,note.ilike.%${safe}%,payee.ilike.%${safe}%,amount.eq.${asNum},amount.eq.${-asNum}`);
      } else {
        query = query.or(`description.ilike.%${safe}%,note.ilike.%${safe}%,payee.ilike.%${safe}%`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Hit[];
    },
  });

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    navigate({ to: "/transactions", search: { account: h.account_id, highlight: h.id } });
  };

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-white hover:bg-white/10 gap-2 h-9"
        title="חיפוש גלובלי (Ctrl+K)"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline text-xs">חיפוש</span>
        <kbd className="hidden md:inline-flex text-[10px] bg-white/10 px-1.5 py-0.5 rounded">⌘K</kbd>
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} shouldFilter={false}>
        <CommandInput
          placeholder="חפש לפי תיאור, הערה, מוטב או סכום…"
          value={q}
          onValueChange={setQ}
        />
        <CommandList>
          {q.trim().length < 2 && <CommandEmpty>הקלד לפחות 2 תווים</CommandEmpty>}
          {q.trim().length >= 2 && !isFetching && hits.length === 0 && <CommandEmpty>לא נמצאו תוצאות</CommandEmpty>}
          {isFetching && <CommandEmpty>מחפש…</CommandEmpty>}
          {hits.length > 0 && (
            <CommandGroup heading={`${hits.length} תוצאות`}>
              {hits.map((h) => (
                <CommandItem key={h.id} value={`${h.id}-${q}`} onSelect={() => go(h)} className="flex justify-between gap-3">
                  <span className="flex flex-col min-w-0">
                    <span className="truncate text-sm">{h.description || h.note || "—"}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(h.transaction_date)} · {acctMap.get(h.account_id) ?? "—"}
                    </span>
                  </span>
                  <span className={`font-mono text-sm whitespace-nowrap ${Number(h.amount) >= 0 ? "text-income" : "text-expense"}`}>
                    {formatCurrency(Number(h.amount))}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
