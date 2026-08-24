import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertSuperAdmin(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (!isAdmin) throw new Error("Forbidden");
}

/** Row counts per table, so the UI can show progress before downloading. */
export const getPortabilityCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PORTABLE_TABLES } = await import("@/lib/portability-tables");

    const entries = await Promise.all(
      PORTABLE_TABLES.map(async (t) => {
        const { count, error } = await supabaseAdmin
          .from(t as any)
          .select("*", { count: "exact", head: true });
        return [t, error ? -1 : count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries) as Record<string, number>;
  });

/** One page of raw rows from a single table. Paged so the worker stays light. */
export const getPortabilityPage = createServerFn({ method: "POST" })
  .inputValidator((data: { table: string; offset: number }) => data)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertSuperAdmin(context);
    const { PORTABLE_TABLES, EXPORT_PAGE_SIZE } = await import("@/lib/portability-tables");
    if (!(PORTABLE_TABLES as readonly string[]).includes(data.table)) {
      throw new Error("Unknown table");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const offset = Math.max(0, Number(data.offset) || 0);
    const { data: rows, error } = await supabaseAdmin
      .from(data.table as any)
      .select("*")
      .range(offset, offset + EXPORT_PAGE_SIZE - 1);
    if (error) throw new Error(`${data.table}: ${error.message}`);
    return { rows: rows ?? [], done: (rows?.length ?? 0) < EXPORT_PAGE_SIZE };
  });

/** The live database schema (DDL-ish description) so a restore can recreate tables. */
export const getPortabilitySchema = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("portability_schema" as any);
    if (error) throw new Error(error.message);
    return data as unknown;
  });
