"use client";

import { useFormState, useFormStatus } from "react-dom";
import {
  createLeagueAction,
  addTeamToLeagueDirect,
} from "./createLeagueAction";
import type { CreateLeagueState, UnassignedTeam } from "./createLeagueTypes";
import { useMemo, useState, useTransition } from "react";

type DivisionOption = { id: string; slug: string; name: string; sport: string };

function SubmitBtn({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn btn--primary" type="submit" disabled={pending}>
      {pending ? "Saving…" : children}
    </button>
  );
}

export default function CreateLeagueClient({
  divisions,
}: {
  divisions: DivisionOption[];
}) {
  const initialState: CreateLeagueState = null;
  const [state, formAction] = useFormState<CreateLeagueState, FormData>(
    createLeagueAction,
    initialState
  );

  const [added, setAdded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [sport, setSport] = useState("basketball");

  const divisionsForSport = useMemo(
    () => divisions.filter((d) => d.sport === sport),
    [divisions, sport]
  );
  const defaultDivision = divisionsForSport[0]?.slug ?? "";

  const handleAdd = (leagueId: string, team: UnassignedTeam) => {
    setAdded((prev) => new Set(prev).add(team.teamId));
    startTransition(async () => {
      const res = await addTeamToLeagueDirect(leagueId, team.teamId);
      if (!res.ok) {
        setAdded((prev) => {
          const next = new Set(prev);
          next.delete(team.teamId);
          return next;
        });
        alert(res.error || "Failed to add team.");
      }
    });
  };

  return (
    <div className="card--soft" style={{ padding: 16 }}>
      <form action={formAction} style={{ display: "grid", gap: 10, maxWidth: 760 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span className="form-label">League name</span>
          <input name="name" className="input" required />
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="form-label">Description</span>
          <textarea name="description" className="input" rows={3} />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="form-label">Sport</span>
            <select
              name="sport"
              className="input"
              required
              value={sport}
              onChange={(e) => setSport(e.target.value)}
            >
              <option value="basketball">basketball</option>
              <option value="volleyball">volleyball</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="form-label">Division</span>
            <select
              name="division"
              className="input"
              required
              key={`${sport}-${defaultDivision}`}
              defaultValue={defaultDivision}
              disabled={divisionsForSport.length === 0}
            >
              {divisionsForSport.length === 0 ? (
                <option value="">No divisions for this sport</option>
              ) : (
                divisionsForSport.map((d) => (
                  <option key={d.id} value={d.slug}>
                    {d.name}
                  </option>
                ))
              )}
            </select>
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="form-label">Gender</span>
            <select name="gender" className="input" required>
              <option value="mens">mens</option>
              <option value="womens">womens</option>
              <option value="coed">coed</option>
            </select>
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="form-label">Minimum team size</span>
            <input
              name="minTeamSize"
              type="number"
              className="input"
              placeholder="e.g. 8"
              min="1"
              defaultValue="8"
            />
          </label>
          <label style={{ display: "grid", gap: 6 }}>
            <span className="form-label">Maximum team size</span>
            <input
              name="maxTeamSize"
              type="number"
              className="input"
              placeholder="e.g. 12"
              min="1"
              defaultValue="12"
            />
          </label>
        </div>

        <label style={{ display: "grid", gap: 6 }}>
          <span className="form-label">Admin (email)</span>
          <input name="adminEmail" type="email" className="input" placeholder="admin@domain.com" />
        </label>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <SubmitBtn>Create League</SubmitBtn>
        </div>
      </form>

      {state?.ok === false && (
        <div
          className="card--soft"
          style={{ marginTop: 16, padding: 16, borderColor: "#fca5a5", color: "#991b1b" }}
        >
          <strong>Couldn’t create league: </strong>
          {state.error}
        </div>
      )}

      {state?.ok === true && (
        <div className="card--soft" style={{ marginTop: 16, padding: 16 }}>
          <h4
            className="content-title"
            style={{ marginTop: 15, fontWeight: 600, fontSize: "22px" }}
          >
            You successfully created league <em>{state.leagueName}</em>.
          </h4>

          {added.size > 0 && (
            <p style={{ marginTop: 0 }}>
              {Array.from(added).length === 1
                ? "Team was successfully added."
                : "Teams were successfully added."}
            </p>
          )}

          {(() => {
            const visible = state.unassigned.filter((t) => !added.has(t.teamId));

            if (visible.length === 0) {
              return <p>All unassigned teams have been added.</p>;
            }

            return (
              <>
                <p style={{ fontWeight: 400, fontSize: "18px", marginTop: 20 }}>
                  Would you like to add teams to the league now? Unassigned teams:
                </p>
                <ul className="roster-list">
                  {visible.map((t) => (
                    <li
                      key={t.teamId}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        className="body-text"
                        style={{ fontWeight: 600, fontSize: "18px", marginLeft: "25px" }}
                      >
                        {t.name}
                      </div>
                      <button
                        className="btn btn--outline btn--sm"
                        type="button"
                        onClick={() => handleAdd(state.leagueId, t)}
                        disabled={isPending}
                      >
                        {isPending ? "Adding…" : "Add to league"}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            );
          })()}

          {state.unassigned.filter((t) => added.has(t.teamId)).length > 0 && (
            <div className="subtle-text" style={{ marginTop: 12 }}>
              Added:{" "}
              {state.unassigned
                .filter((t) => added.has(t.teamId))
                .map((t) => t.name)
                .join(", ")}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
