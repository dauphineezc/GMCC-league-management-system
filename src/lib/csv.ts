// /src/lib/csv.ts
export function toCsv(rows: Array<Record<string, any>>, headers: string[]): string {
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const head = headers.join(",");
    const body = rows.map(r => headers.map(h => esc(r[h])).join(",")).join("\n");
    // If you want Excel to auto-detect UTF-8: prepend \uFEFF
    return `${head}\n${body}`;
  }
  
  export function yyyymmdd() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  /** Build an export URL that preserves the current page filters as query params. */
  export function exportHref(
    path: string,
    params: Record<string, string | string[] | undefined | null>
  ): string {
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      const raw = Array.isArray(value) ? value[0] : value;
      if (raw == null) continue;
      const s = String(raw).trim();
      if (!s) continue;
      sp.set(key, s);
    }
    const qs = sp.toString();
    return qs ? `${path}?${qs}` : path;
  } 