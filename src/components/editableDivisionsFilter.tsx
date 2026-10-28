"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import FilterChevron from "@/components/filterChevron";

export type DivisionOption = {
  id: string;
  slug: string;
  name: string;
  sport: string;
};

type Props = {
  name?: string;
  sportName?: string;
  /** Selected division slug(s). */
  defaultValue?: string | string[];
  defaultSport?: string;
  sports?: string[];
  divisions: DivisionOption[];
  className?: string;
  style?: React.CSSProperties;
  /** When true, show add/edit/delete controls (superadmin leagues page). */
  editable?: boolean;
};

const DEFAULT_SPORTS = ["basketball", "volleyball"];

const title = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

function normalizeDefaultDivisions(value: string | string[] | undefined): string[] {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      list
        .flatMap((v) => String(v).split(","))
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export default function EditableDivisionsFilter({
  name = "division",
  sportName = "sport",
  defaultValue = "",
  defaultSport = "",
  sports = DEFAULT_SPORTS,
  divisions: initial,
  className = "input",
  style,
  editable = false,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const rootRef = useRef<HTMLDivElement>(null);
  const [divisions, setDivisions] = useState(initial);
  const [sport, setSport] = useState(defaultSport);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>(() =>
    normalizeDefaultDivisions(defaultValue)
  );
  const [open, setOpen] = useState(false);
  const [expandedSport, setExpandedSport] = useState<string | null>(
    defaultSport || null
  );
  const [managing, setManaging] = useState(false);
  const [manageSport, setManageSport] = useState(
    defaultSport || sports[0] || "basketball"
  );
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDivisions(initial);
  }, [initial]);

  useEffect(() => {
    setSport(defaultSport);
    setSelectedDivisions(normalizeDefaultDivisions(defaultValue));
    if (defaultSport) {
      setManageSport(defaultSport);
      setExpandedSport(defaultSport);
    }
  }, [defaultSport, defaultValue]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const divisionsBySport = useMemo(() => {
    const map = new Map<string, DivisionOption[]>();
    for (const s of sports) map.set(s, []);
    for (const d of divisions) {
      const list = map.get(d.sport) ?? [];
      list.push(d);
      map.set(d.sport, list);
    }
    return map;
  }, [divisions, sports]);

  const managedDivisions = useMemo(
    () => divisions.filter((d) => d.sport === manageSport),
    [divisions, manageSport]
  );

  const summaryLabel = useMemo(() => {
    if (!sport) return "All sports";
    const sportLabel = title(sport);
    if (selectedDivisions.length === 0) return sportLabel;
    const catalog = divisionsBySport.get(sport) ?? [];
    const names = selectedDivisions.map((slug) => {
      const hit = catalog.find((d) => d.slug === slug);
      return hit?.name ?? slug;
    });
    if (names.length <= 2) return `${sportLabel} › ${names.join(", ")}`;
    return `${sportLabel} › ${names.length} divisions`;
  }, [sport, selectedDivisions, divisionsBySport]);

  function refresh() {
    router.refresh();
  }

  /** Submit the parent GET form with the given sport/division selection. */
  function applyFilter(nextSport: string, nextDivisions: string[]) {
    setSport(nextSport);
    setSelectedDivisions(nextDivisions);
    setOpen(false);

    const form = rootRef.current?.closest("form");
    const params = new URLSearchParams();
    if (form instanceof HTMLFormElement) {
      const fd = new FormData(form);
      for (const [key, value] of fd.entries()) {
        if (key === sportName || key === name) continue;
        if (typeof value === "string" && value !== "") {
          params.append(key, value);
        }
      }
    }
    if (nextSport) params.set(sportName, nextSport);
    for (const slug of nextDivisions) params.append(name, slug);

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function clearAll() {
    setExpandedSport(null);
    applyFilter("", []);
  }

  function selectSportOnly(next: string) {
    setManageSport(next);
    setExpandedSport(next);
    applyFilter(next, []);
  }

  function toggleDivision(sportKey: string, slug: string) {
    const fromOtherSport = sport !== sportKey;
    const base = fromOtherSport ? [] : selectedDivisions;
    const next = base.includes(slug)
      ? base.filter((s) => s !== slug)
      : [...base, slug];
    setManageSport(sportKey);
    setExpandedSport(sportKey);
    applyFilter(sportKey, next);
  }

  function toggleExpand(sportKey: string, e?: React.MouseEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setExpandedSport((cur) => (cur === sportKey ? null : sportKey));
  }

  function handleAdd() {
    const nameValue = newName.trim();
    if (!nameValue || !manageSport) return;
    setErr(null);
    startTransition(async () => {
      const res = await fetch("/api/superadmin/divisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nameValue, sport: manageSport }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.error || "Failed to add division");
        return;
      }
      setNewName("");
      if (j.division) {
        setDivisions((prev) => [...prev, j.division]);
      }
      refresh();
    });
  }

  function handleSave(id: string) {
    const nameValue = (drafts[id] ?? "").trim();
    if (!nameValue) return;
    setErr(null);
    startTransition(async () => {
      const res = await fetch(`/api/superadmin/divisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ name: nameValue }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.error || "Failed to update division");
        return;
      }
      if (j.division) {
        setDivisions((prev) =>
          prev.map((d) => (d.id === id ? { ...d, name: j.division.name } : d))
        );
      }
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      refresh();
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this division from the catalog?")) return;
    setErr(null);
    startTransition(async () => {
      const res = await fetch(`/api/superadmin/divisions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(j?.error || "Failed to delete division");
        return;
      }
      setDivisions((prev) => prev.filter((d) => d.id !== id));
      refresh();
    });
  }

  return (
    <>
      <div className="sport-division-accordion" ref={rootRef} style={style}>
        <div className="sport-division-accordion__toolbar">
          <button
            type="button"
            className={`${className} sport-division-accordion__trigger`}
            aria-expanded={open}
            aria-haspopup="listbox"
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sport-division-accordion__trigger-label">
              {summaryLabel}
            </span>
            <FilterChevron
              direction={open ? "up" : "down"}
              className="sport-division-accordion__chevron"
            />
          </button>

          {editable && (
            <button
              type="button"
              className="btn btn--light btn--sm"
              onClick={() => {
                setManaging((v) => !v);
                setOpen(false);
                setErr(null);
              }}
            >
              {managing ? "Done" : "Edit"}
            </button>
          )}
        </div>

        <input type="hidden" name={sportName} value={sport} />
        {selectedDivisions.length === 0 ? (
          <input type="hidden" name={name} value="" />
        ) : (
          selectedDivisions.map((slug) => (
            <input key={slug} type="hidden" name={name} value={slug} />
          ))
        )}

        {open && (
          <div className="sport-division-accordion__panel" role="listbox">
            <div className="sport-division-accordion__sports">
              <button
                type="button"
                className={
                  "sport-division-accordion__sport" +
                  (!sport ? " is-active" : "")
                }
                onClick={() => clearAll()}
              >
                All sports/divisions
              </button>

              {sports.map((s) => {
                const isExpanded = expandedSport === s;
                const isActive = sport === s;
                const catalog = divisionsBySport.get(s) ?? [];

                return (
                  <div
                    key={s}
                    className={
                      "sport-division-accordion__sport-row" +
                      (isActive ? " is-active" : "") +
                      (isExpanded ? " is-expanded" : "")
                    }
                    onMouseEnter={() => setExpandedSport(s)}
                  >
                    <button
                      type="button"
                      className="sport-division-accordion__expand"
                      aria-label={`${isExpanded ? "Collapse" : "Expand"} ${title(s)} divisions`}
                      aria-expanded={isExpanded}
                      onClick={(e) => toggleExpand(s, e)}
                    >
                      <FilterChevron direction={isExpanded ? "down" : "right"} />
                    </button>
                    <button
                      type="button"
                      className="sport-division-accordion__sport"
                      onClick={() => {
                        selectSportOnly(s);
                      }}
                    >
                      {title(s)}
                    </button>

                    {isExpanded && (
                      <div className="sport-division-accordion__divisions">
                        {catalog.length === 0 ? (
                          <div className="sport-division-accordion__empty muted">
                            No divisions for {title(s)}
                          </div>
                        ) : (
                          catalog.map((d) => {
                            const checked =
                              sport === s && selectedDivisions.includes(d.slug);
                            return (
                              <label
                                key={d.id}
                                className={
                                  "sport-division-accordion__division" +
                                  (checked ? " is-checked" : "")
                                }
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleDivision(s, d.slug)}
                                />
                                <span>{d.name}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {editable && managing && (
        <div
          className="card--soft sport-division-accordion__manage"
          style={{ padding: 12, display: "grid", gap: 10 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              justifyContent: "space-between",
            }}
          >
            <div className="form-label" style={{ fontWeight: 600 }}>
              Manage divisions
            </div>
            <select
              className="input"
              value={manageSport}
              onChange={(e) => setManageSport(e.target.value)}
              aria-label="Sport for division catalog"
              style={{ minWidth: 140 }}
            >
              {sports.map((s) => (
                <option key={s} value={s}>
                  {title(s)}
                </option>
              ))}
            </select>
          </div>

          {managedDivisions.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              No divisions yet for {title(manageSport)}.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gap: 8,
              }}
            >
              {managedDivisions.map((d) => {
                const draft = drafts[d.id];
                const editing = draft !== undefined;
                return (
                  <li
                    key={d.id}
                    style={{
                      display: "flex",
                      gap: 8,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    {editing ? (
                      <>
                        <input
                          className="input"
                          value={draft}
                          onChange={(e) =>
                            setDrafts((prev) => ({
                              ...prev,
                              [d.id]: e.target.value,
                            }))
                          }
                          style={{ flex: 1, minWidth: 120 }}
                          aria-label={`Edit name for ${d.slug}`}
                        />
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={isPending}
                          onClick={() => handleSave(d.id)}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="btn btn--light btn--sm"
                          disabled={isPending}
                          onClick={() =>
                            setDrafts((prev) => {
                              const next = { ...prev };
                              delete next[d.id];
                              return next;
                            })
                          }
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <span style={{ flex: 1, minWidth: 120, fontWeight: 500 }}>
                          {d.name}
                        </span>
                        <button
                          type="button"
                          className="btn btn--light btn--sm"
                          disabled={isPending}
                          onClick={() =>
                            setDrafts((prev) => ({ ...prev, [d.id]: d.name }))
                          }
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          className="btn btn--light btn--sm"
                          disabled={isPending}
                          onClick={() => handleDelete(d.id)}
                          style={{ color: "#991b1b" }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              className="input"
              placeholder={`New ${title(manageSport)} division`}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={{ flex: 1, minWidth: 140 }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
            <button
              type="button"
              className="btn btn--outline btn--sm"
              disabled={isPending || !newName.trim()}
              onClick={handleAdd}
            >
              Add
            </button>
          </div>

          {err && (
            <div className="subtle-text" style={{ color: "#dc2626" }}>
              {err}
            </div>
          )}
        </div>
      )}
    </>
  );
}
