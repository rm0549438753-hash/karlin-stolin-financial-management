/**
 * "Full viewer" = a read-only account (e.g. the temporary guest link) that may
 * SEE everything a superadmin sees, but can never write: it holds no
 * admin/editor role, so every write policy and every write server function
 * still rejects it. Read gates call this in addition to their role checks.
 */
export async function isFullViewer(ctx: any): Promise<boolean> {
  try {
    const { data } = await (ctx.supabase as any).rpc("is_full_viewer", { _uid: ctx.userId });
    return !!data;
  } catch {
    return false;
  }
}
