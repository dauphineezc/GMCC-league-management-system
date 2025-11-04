"use client";

import * as React from "react";

type Totals = {
  all: number;
  managers: number;
  paid: number;
  unpaid: number;
  managersPaid: number;
  managersUnpaid: number;
};

type TeamOption = {
  id: string;
  name: string;
};

type Props = {
  totals: Totals;
  teams?: TeamOption[];
};

export default function AnnouncementFilters({ totals, teams = [] }: Props) {
  const [paymentFilter, setPaymentFilter] = React.useState<"all" | "paid" | "unpaid">("all");
  const [managersOnly, setManagersOnly] = React.useState(false);
  const [selectedTeams, setSelectedTeams] = React.useState<string[]>([]);
  const [teamDropdownOpen, setTeamDropdownOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setTeamDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const filteredCount = React.useMemo(() => {
    if (managersOnly && paymentFilter === "all") return totals.managers;
    if (managersOnly && paymentFilter === "paid") return totals.managersPaid;
    if (managersOnly && paymentFilter === "unpaid") return totals.managersUnpaid;
    if (!managersOnly && paymentFilter === "paid") return totals.paid;
    if (!managersOnly && paymentFilter === "unpaid") return totals.unpaid;
    return totals.all;
  }, [managersOnly, paymentFilter, totals]);

  const details =
    managersOnly && paymentFilter === "all"
      ? " (team managers only)"
      : paymentFilter === "paid"
      ? ` (paid players${managersOnly ? " who are managers" : ""})`
      : paymentFilter === "unpaid"
      ? ` (unpaid players${managersOnly ? " who are managers" : ""})`
      : "";
  
  const teamFilterText = selectedTeams.length > 0 
    ? ` from ${selectedTeams.length} selected team${selectedTeams.length > 1 ? 's' : ''}`
    : "";

  return (
    <>
    <div
        className="card--soft"
        style={{
            maxWidth: 800,
            width: "100%",
            padding: "1.25rem 1.5rem",
            margin: "0", // was "0 auto" before
        }}
        >
        <h2
            className="section-title"
            style={{
            fontSize: 20,
            marginTop: 0,
            marginBottom: 12,
            fontWeight: 400,
            }}
        >
            Recipient Filters
        </h2>

        <div
            style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            }}
        >
            <select
            name="paymentFilter"
            id="paymentFilter"
            className="input"
            style={{
                minWidth: 160,
                maxWidth: 200,
                height: 38,
            }}
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as any)}
            >
            <option value="all">All players</option>
            <option value="paid">Paid only</option>
            <option value="unpaid">Unpaid only</option>
            </select>

            <label
            htmlFor="managersOnly"
            className="input"
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 10px",
                cursor: "pointer",
                height: 38,
            }}
            title="Send only to team managers"
            >
            <input
                type="checkbox"
                id="managersOnly"
                checked={managersOnly}
                onChange={(e) => setManagersOnly(e.target.checked)}
            />
            <span className="form-label" style={{ fontSize: 14 }}>
                Managers only
            </span>
            </label>

            {/* Team Filter */}
            {teams.length > 0 && (
              <div style={{ position: "relative", flex: "1 1 200px", minWidth: 150, maxWidth: 250 }} ref={dropdownRef}>
                <button
                  type="button"
                  className="input"
                  onClick={() => setTeamDropdownOpen(!teamDropdownOpen)}
                  style={{
                    width: "100%",
                    height: 38,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0 12px",
                    cursor: "pointer",
                    backgroundColor: "white",
                    textAlign: "left",
                  }}
                >
              <span style={{ fontSize: 14, color: "var(--navy)" }}>
                {selectedTeams.length === 0 
                  ? "All teams" 
                  : selectedTeams.length === teams.length
                  ? "All teams selected"
                  : `${selectedTeams.length} team${selectedTeams.length > 1 ? 's' : ''} selected`
                }
              </span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                style={{
                  transition: "transform 0.2s ease",
                  transform: teamDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                }}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
              </svg>
            </button>
                
                {/* Hidden select for form submission */}
                <select
                  id="teamFilter"
                  name="teamFilter"
                  multiple
                  value={selectedTeams}
                  onChange={() => {}}
                  style={{ display: "none" }}
                >
                  {teams.map(team => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>

                {/* Dropdown Menu */}
                {teamDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: 4,
                      backgroundColor: "white",
                      border: "1px solid #d1d5db",
                      borderRadius: 6,
                      boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
                      maxHeight: 300,
                      overflowY: "auto",
                      zIndex: 50,
                    }}
                  >
                    {/* Team Checkboxes */}
                    {teams.map(team => (
                      <div
                        key={team.id}
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid #f3f4f6",
                        }}
                      >
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: "pointer",
                            fontSize: 14,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedTeams.includes(team.id)}
                            onChange={() => handleTeamToggle(team.id)}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                          />
                          <span>{team.name}</span>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
        </div>

        <div
            className="subtle-text"
            style={{ marginTop: 10, fontSize: 14, color: "#6b7280" }}
        >
            {totals.all} total players: {totals.managers} managers, {totals.paid} paid,{" "}
            {totals.unpaid} unpaid
        </div>

        <div
            className="subtle-text"
            style={{ marginTop: 4, fontSize: 14, color: "#6b7280" }}
        >
            {selectedTeams.length > 0 
              ? `Announcement will be sent to selected recipients${details}${teamFilterText}`
              : `${filteredCount} recipients will receive this announcement${details}`
            }
        </div>
        </div>

      {/* Hidden inputs inside the form */}
      <input type="hidden" name="paymentFilter" value={paymentFilter} />
      <input type="hidden" name="managersOnly" value={managersOnly ? "on" : ""} />
    </>
  );
}