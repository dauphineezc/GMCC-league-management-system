"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export type DivisionOption = {
  id: string;
  slug: string;
  name: string;
  sport: string;
};

type Props = {
  name?: string;
  sportName?: string;
  defaultValue?: string;
  defaultSport?: string;
  sports?: string[];
  divisions: DivisionOption[];
  /** Extra option values (e.g. discovered on existing records) not in the catalog. */
  extraSlugs?: string[];
  className?: string;
  style?: React.CSSProperties;
  /** When true, show add/edit/delete controls (superadmin leagues page). */
  editable?: boolean;
};

const DEFAULT_SPORTS = ["basketball", "volleyball"];

const title = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");

export default function EditableDivisionsFilter({
  name = "division",
  sportName = "sport",
  defaultValue = "",
  defaultSport = "",
  sports = DEFAULT_SPORTS,
  divisions: initial,
  extraSlugs = [],
  className = "input",
  style,
  editable = false,
}: Props) {
  const router = useRouter();
  const [divisions, setDivisions] = useState(initial);
  const [sport, setSport] = useState(defaultSport);
  const [division, setDivision] = useState(defaultValue);
  const [managing, setManaging] = useState(false);
  const [manageSport, setManageSport] = useState(defaultSport || sports[0] || "basketball");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setDivisions(initial);
  }, [initial]);

  useEffect(() => {
    setSport(defaultSport);
    setDivision(defaultValue);
    if (defaultSport) setManageSport(defaultSport);
  }, [defaultSport, defaultValue]);

  const visibleDivisions = useMemo(() => {
    if (!sport) return [];
    return divisions.filter((d) => d.sport === sport);
  }, [divisions, sport]);

  const managedDivisions = useMemo(
    () => divisions.filter((d) => d.sport === manageSport),
    [divisions, manageSport]
  );

  const catalogSlugs = new Set(visibleDivisions.map((d) => d.slug));
  const orphanSlugs = extraSlugs.filter((s) => s && !catalogSlugs.has(s));

  function refresh() {
    router.refresh();
  }

  function onSportChange(next: string) {
    setSport(next);
    setDivision("");
    if (next) setManageSport(next);
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
      <div className="sport-division-cascade">
        <div className="sport-division-cascade__row">
          <select
            name={sportName}
            value={sport}
            onChange={(e) => onSportChange(e.target.value)}
            className={className}
            style={style}
            aria-label="Sport / division filter"
          >
            <option value="">All sports/divisions</option>
            {sports.map((s) => (
              <option key={s} value={s}>
                {title(s)}
              </option>
            ))}
          </select>

          {sport ? (
            <>
              <span className="sport-division-cascade__arrow" aria-hidden="true">
                ›
              </span>
              <select
                name={name}
                value={division}
                onChange={(e) => setDivision(e.target.value)}
                className={className}
                style={style}
                aria-label="Division filter"
              >
                <option value="">All divisions</option>
                {visibleDivisions.map((d) => (
                  <option key={d.id} value={d.slug}>
                    {d.name}
                  </option>
                ))}
                {orphanSlugs.map((s) => (
                  <option key={`orphan-${s}`} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <input type="hidden" name={name} value="" />
          )}

          {editable && (
            <button
              type="button"
              className="btn btn--light btn--sm"
              onClick={() => {
                setManaging((v) => !v);
                setErr(null);
              }}
            >
              {managing ? "Done" : "Edit"}
            </button>
          )}
        </div>
      </div>

      {editable && managing && (
        <div
          className="card--soft sport-division-cascade__manage"
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
            <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
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
                            setDrafts((prev) => ({ ...prev, [d.id]: e.target.value }))
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
