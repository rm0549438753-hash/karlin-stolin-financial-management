// Server-only helper for running npm dependency security audit.
// Uses the public OSV.dev API (batch query) which is stable, free, and CORS-friendly.
// OSV aggregates GitHub Security Advisories + npm advisories for the npm ecosystem.

type Severity = "low" | "moderate" | "high" | "critical";

type Vuln = {
  package: string;
  version: string;
  severity: Severity;
  id: string;
  summary: string;
  fixed_in?: string;
  reference?: string;
};

type OsvVuln = {
  id: string;
  summary?: string;
  details?: string;
  database_specific?: { severity?: string };
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    ranges?: Array<{ events?: Array<{ fixed?: string; introduced?: string }> }>;
  }>;
  references?: Array<{ url: string }>;
};

function mapSeverity(v: OsvVuln): Severity {
  const raw =
    v.database_specific?.severity?.toString().toLowerCase() ||
    v.severity?.[0]?.score?.toString().toLowerCase() ||
    "";
  if (raw.includes("critical")) return "critical";
  if (raw.includes("high")) return "high";
  if (raw.includes("moderate") || raw.includes("medium")) return "moderate";
  if (raw.includes("low")) return "low";
  // CVSS numeric fallback
  const num = parseFloat(raw);
  if (!isNaN(num)) {
    if (num >= 9) return "critical";
    if (num >= 7) return "high";
    if (num >= 4) return "moderate";
    return "low";
  }
  return "moderate";
}

function firstFixedVersion(v: OsvVuln): string | undefined {
  for (const a of v.affected ?? []) {
    for (const r of a.ranges ?? []) {
      for (const e of r.events ?? []) {
        if (e.fixed) return e.fixed;
      }
    }
  }
  return undefined;
}

function cleanVersion(v: string): string {
  // Strip semver range prefixes: ^1.2.3, ~1.2.3, >=1.2.3 -> 1.2.3
  return v.replace(/^[\^~><=v\s]+/g, "").trim();
}

async function readPackageJson(): Promise<Record<string, string>> {
  // Bundled at build time — the file is embedded, not read from disk at runtime.
  // Using dynamic import with a JSON assertion works in the Cloudflare worker.
  const pkg = (await import("../../package.json")).default as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  return { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
}

export async function runSecurityAudit(triggeredBy: "cron" | "manual") {
  const deps = await readPackageJson();
  const entries = Object.entries(deps);

  // Build OSV batch query
  const queries = entries.map(([name, version]) => ({
    package: { name, ecosystem: "npm" },
    version: cleanVersion(version),
  }));

  const res = await fetch("https://api.osv.dev/v1/querybatch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ queries }),
  });
  if (!res.ok) {
    throw new Error(`OSV API returned ${res.status}: ${await res.text()}`);
  }
  const batch = (await res.json()) as {
    results: Array<{ vulns?: Array<{ id: string }> }>;
  };

  // Collect unique vulnerability IDs to fetch full details
  const idToPackages = new Map<string, { name: string; version: string }>();
  batch.results.forEach((r, idx) => {
    for (const v of r.vulns ?? []) {
      if (!idToPackages.has(v.id)) {
        idToPackages.set(v.id, { name: entries[idx][0], version: cleanVersion(entries[idx][1]) });
      }
    }
  });

  // Fetch details in parallel (cap to avoid too many concurrent requests)
  const ids = [...idToPackages.keys()];
  const details: OsvVuln[] = [];
  const CHUNK = 10;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    const results = await Promise.all(
      chunk.map((id) =>
        fetch(`https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
      ),
    );
    for (const r of results) if (r) details.push(r as OsvVuln);
  }

  const vulns: Vuln[] = details.map((d) => {
    const pkg = idToPackages.get(d.id)!;
    return {
      package: pkg.name,
      version: pkg.version,
      severity: mapSeverity(d),
      id: d.id,
      summary: d.summary ?? d.details?.slice(0, 200) ?? d.id,
      fixed_in: firstFixedVersion(d),
      reference: d.references?.[0]?.url,
    };
  });

  const counts = { low: 0, moderate: 0, high: 0, critical: 0 };
  for (const v of vulns) counts[v.severity]++;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("security_audit_runs")
    .insert({
      status: vulns.length > 0 ? "vulnerabilities" : "ok",
      low_count: counts.low,
      moderate_count: counts.moderate,
      high_count: counts.high,
      critical_count: counts.critical,
      total_dependencies: entries.length,
      report_json: { vulnerabilities: vulns } as any,
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return {
    ok: true,
    runId: data.id,
    totalDependencies: entries.length,
    vulnerabilities: vulns.length,
    counts,
  };
}

export async function recordAuditFailure(triggeredBy: "cron" | "manual", err: unknown) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("security_audit_runs").insert({
      status: "failed",
      triggered_by: triggeredBy,
      error_message: err instanceof Error ? err.message : String(err),
    });
  } catch (e) {
    console.error("[security-audit] failed to record failure:", e);
  }
}
