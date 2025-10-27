export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { kv } from "@vercel/kv";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import { sendAnnouncementAction } from "./actions"; // <-- import the server action
import * as React from "react";
import AnnouncementFilters from "@/components/announcementFilters";

type LeaguePlayerRow = {
  userId: string;
  displayName: string;
  teamId: string;
  teamName: string;
  isManager: boolean;
  paymentStatus?: "PAID" | "UNPAID";
};

async function isAdminOfLeague(userId: string, leagueId: string) {
  // lightweight check for gating the page itself
  try {
    const inPerLeagueSet = await kv.sismember<string>(`league:${leagueId}:admins`, userId);
    if (inPerLeagueSet) return true;
  } catch {}
  try {
    const isMember = await kv.sismember<string>(`admin:${userId}:leagues`, leagueId);
    if (isMember) return true;
  } catch {}
  return false;
}

export default async function SendAnnouncementPage({ params }: { params: { leagueId: string } }) {
  const leagueId = params.leagueId;
  const user = await getServerUser();
  if (!user) redirect("/login");
  const ok = await isAdminOfLeague(user.id, leagueId);
  if (!ok) redirect(`/leagues/${leagueId}`);

  // quick counts for the UI
  const leaguePlayersKey = `league:${leagueId}:players`;
  const leaguePlayers = (await kv.get<LeaguePlayerRow[]>(leaguePlayersKey)) ?? [];
  const totals = {
    all: leaguePlayers.length,
    managers: leaguePlayers.filter((p) => p.isManager).length,
    paid: leaguePlayers.filter((p) => p.paymentStatus === "PAID").length,
    unpaid: leaguePlayers.filter((p) => p.paymentStatus === "UNPAID").length,
    // Calculate intersections
    managersPaid: leaguePlayers.filter((p) => p.isManager && p.paymentStatus === "PAID").length,
    managersUnpaid: leaguePlayers.filter((p) => p.isManager && p.paymentStatus === "UNPAID").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Section */}
      <div className="bg-white shadow-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="page-title">Send Announcement</h1>
              <p className="mt-1 text-sm text-gray-600">Send updates and notifications to league members</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters (client) */}
      <AnnouncementFilters totals={totals} />

      {/* Form Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="section-title">Compose Announcement</h2>

          <form action={sendAnnouncementAction} className="p-6 space-y-6">
            <input type="hidden" name="leagueId" value={leagueId} />

            {/* Message Composition */}
            <div className="space-y-4">
                {/* Subject Field */}
                <div>
                  <label htmlFor="subject" className="text-sm font-medium text-gray-700" style={{ fontWeight: 'bold', fontSize: '16px', alignSelf: 'flex-start' }}>
                    Subject Line:
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    type="text"
                    required
                    className="input"
                    style={{ marginLeft: '10px', marginBottom: '10px', minWidth: '30%' }}
                    placeholder="League update: schedule & reminders"
                  />
                </div>

              {/* Message Field */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <label htmlFor="message" className="text-sm font-medium text-gray-700" style={{ fontWeight: 'bold', fontSize: '16px', alignSelf: 'flex-start' }}>
                  Message:
                </label>
                <textarea
                  id="message"
                  name="message"
                  rows={8}
                  required
                  className="input"
                  style={{ flex: 1 }}
                  placeholder={`Hello everyone,\n\nHere are this week's updates...`}
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3 pt-6 border-t border-gray-200" style={{ justifyContent: 'end' }}>
              <button
                type="submit"
                className="btn btn--primary"
                style={{ marginTop: '20px' }}
              >
                <span style={{ fontSize: '16px' }}>Send Announcement</span>
                <svg style={{ width: '18px', height: '18px', marginLeft: '6px', transform: 'rotate(90deg)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>
  );
}