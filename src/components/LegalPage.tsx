import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import logoAsset from "@/assets/karlin-logo.png.asset.json";

const GOLD = "#D4AF37";

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="space-y-2 text-sm leading-7 text-muted-foreground [&_ul]:list-disc [&_ul]:pr-6 [&_ul]:space-y-1 [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div dir="rtl" className="min-h-screen bg-background">
      <header
        className="bg-[#0d3b66] px-4 py-6 flex items-center gap-4"
        style={{ borderBottom: `4px solid ${GOLD}` }}
      >
        <div
          className="h-14 w-14 bg-white rounded-full flex items-center justify-center overflow-hidden shrink-0"
          style={{ border: `2px solid ${GOLD}` }}
        >
          <img src={logoAsset.url} alt="" className="h-[120%] w-[120%] object-contain scale-110" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-extrabold leading-none" style={{ color: GOLD }}>
            {title}
          </h1>
          <p className="text-white/60 text-xs mt-1">מרכז קארלין סטאלין · אגודת בית אולפנא</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <p className="text-xs text-muted-foreground">עודכן לאחרונה: {updated}</p>
        {children}
        <div className="pt-4">
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            חזרה למסך הכניסה
          </Link>
        </div>
      </main>
    </div>
  );
}
