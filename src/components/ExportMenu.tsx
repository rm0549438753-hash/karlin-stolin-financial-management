import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";

type Size = "sm" | "default" | "lg";

interface ExportMenuProps {
  onExcel: () => void;
  onPdf: () => void;
  disabled?: boolean;
  size?: Size;
  label?: string;
  variant?: "default" | "outline" | "ghost" | "secondary";
}

export function ExportMenu({
  onExcel,
  onPdf,
  disabled,
  size = "sm",
  label = "ייצוא",
  variant = "outline",
}: ExportMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={disabled}>
          <Download className="w-4 h-4 ml-1" />
          {label}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[10rem]">
        <DropdownMenuItem onClick={onExcel} className="gap-2 cursor-pointer">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
          אקסל (XLSX)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onPdf} className="gap-2 cursor-pointer">
          <FileText className="w-4 h-4 text-red-600" />
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
