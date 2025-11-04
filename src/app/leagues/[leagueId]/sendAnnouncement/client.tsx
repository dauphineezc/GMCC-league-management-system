// src/app/leagues/[leagueId]/sendAnnouncement/client.tsx

"use client";

import { useState } from "react";
import { sendAnnouncementAction } from "./actions";
import AnnouncementFilters from "@/components/announcementFilters";

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

interface SendAnnouncementClientProps {
  leagueId: string;
  totals: Totals;
  teams: TeamOption[];
}

export default function SendAnnouncementClient({ leagueId, totals, teams }: SendAnnouncementClientProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error", message: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsSending(true);
    setNotification(null);

    const formData = new FormData();
    formData.append("leagueId", leagueId);
    formData.append("subject", subject);
    formData.append("message", message);

    // Get filter values from the filters component
    const paymentFilter = (document.getElementById("paymentFilter") as HTMLSelectElement)?.value || "all";
    const managersOnly = (document.getElementById("managersOnly") as HTMLInputElement)?.checked || false;
    const teamSelect = document.getElementById("teamFilter") as HTMLSelectElement;
    const selectedTeams = teamSelect ? Array.from(teamSelect.selectedOptions).map(opt => opt.value) : [];

    formData.append("paymentFilter", paymentFilter);
    if (managersOnly) {
      formData.append("managersOnly", "on");
    }
    // Pass selected team IDs as JSON
    if (selectedTeams.length > 0) {
      formData.append("teamIds", JSON.stringify(selectedTeams));
    }

    try {
      await sendAnnouncementAction(formData);
      
      // Success - clear form and show success message
      setSubject("");
      setMessage("");
      setNotification({ type: "success", message: "Announcement sent successfully!" });
      
      // Clear notification after 3 seconds
      setTimeout(() => setNotification(null), 3000);
    } catch (error: any) {
      // Error - show error message, don't clear form
      setNotification({ 
        type: "error", 
        message: error?.message || "Failed to send announcement. Please try again." 
      });
    } finally {
      setIsSending(false);
    }
  }

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
      <AnnouncementFilters totals={totals} teams={teams} />

      {/* Form Section */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <h2 className="section-title">Compose Announcement</h2>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
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
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>
          </div>
          
        {/* Notification Banner */}
        {notification && (
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 py-4">
            <div className={`p-4 rounded-lg ${
                notification.type === "success" 
                ? "bg-green-50 border border-green-200 text-green-800" 
                : "bg-red-50 border border-red-200 text-red-800"
            }`}>
                <p className="text-sm font-medium">{notification.message}</p>
            </div>
            </div>
        )}

          {/* Submit Button */}
          <div className="flex flex-col sm:flex-row sm:justify-end sm:space-x-3 pt-6 border-t border-gray-200" style={{ justifyContent: 'end' }}>
            <button
              type="submit"
              className="btn btn--primary"
              style={{ marginTop: '20px' }}
              disabled={isSending}
            >
              <span style={{ fontSize: '16px' }}>{isSending ? "Sending..." : "Send Announcement"}</span>
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

