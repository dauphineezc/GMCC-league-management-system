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

type Props = {
  totals: Totals;
};

export default function AnnouncementFilters({ totals }: Props) {
  const [paymentFilter, setPaymentFilter] = React.useState<"all" | "paid" | "unpaid">("all");
  const [managersOnly, setManagersOnly] = React.useState(false);

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

  return (
    <>
    <div
        className="card--soft"
        style={{
            maxWidth: 600,
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
            {filteredCount} recipients will receive this announcement{details}
        </div>
        </div>

      {/* Hidden inputs inside the form */}
      <input type="hidden" name="paymentFilter" value={paymentFilter} />
      <input type="hidden" name="managersOnly" value={managersOnly ? "on" : ""} />
    </>
  );
}