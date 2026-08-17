import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";

type Size = "sm" | "default" | "lg";

interface ExportMenuProps {
  onExcel: () => void | Promise<void>;
  onPdf: () => void | Promise<void>;
  disabled?: boolean;
  size?: Size;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** When the PDF action only opens the print dialog, skip the export toast. */
  pdfOpensDialog?: boolean;
}

export function ExportMenu({
  onExcel,
  onPdf,
  disabled,
  size = "sm",
  label = "ייצוא",
  variant = "outline",
  pdfOpensDialog,
}: ExportMenuProps) {
  /** Wraps an export handler with clear "preparing / done / failed" toasts. */
  const run = async (kind: "אקסל" | "PDF", fn: () => void | Promise<void>) => {
    const id = toast.loading(`מכין קובץ ${kind}…`);
    try {
      await fn();
      toast.success(`הקובץ (${kind}) יוצא בהצלחה`, { id });
    } catch (e: any) {
      toast.error(e?.message ?? `הייצוא (${kind}) נכשל`, { id });
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}>
          <Download className="w-4 h-4 ml-1" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem onClick={() => run("אקסל", onExcel)} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          אקסל (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => (pdfOpensDialog ? onPdf() : run("PDF", onPdf))} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-600" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
