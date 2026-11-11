// /src/components/accountSettingsClient.tsx
"use client";

import { useState } from "react";
import { sendEmailVerification } from "firebase/auth";
import { auth } from "@/lib/firebaseClient";
import { parseDob, parsePersonName, parsePhone } from "@/lib/profileValidation";

type UserData = {
  id: string;
  email: string | null;
  displayName: string;
  emailVerified: boolean;
  phone: string;
  dob: string;
};

type Props = {
  user: UserData;
};

function formatDobDisplay(dob: string): string {
  if (!dob) return "Not set";
  const d = new Date(`${dob}T00:00:00`);
  if (Number.isNaN(d.getTime())) return dob;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function AccountSettingsClient({ user }: Props) {
  const [currentUser, setCurrentUser] = useState(user);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit name state
  const nameParts = (currentUser.displayName || "").split(" ");
  const [firstName, setFirstName] = useState(nameParts[0] || "");
  const [lastName, setLastName] = useState(nameParts.slice(1).join(" ") || "");
  const [isEditingName, setIsEditingName] = useState(false);

  // Edit DOB state
  const [dob, setDob] = useState(currentUser.dob || "");
  const [isEditingDob, setIsEditingDob] = useState(false);

  // Edit phone state
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [isEditingPhone, setIsEditingPhone] = useState(false);

  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const [sendingVerification, setSendingVerification] = useState(false);

  const handleSendVerification = async () => {
    setError("");
    setSuccess("");
    const fbUser = auth.currentUser;
    if (!fbUser) {
      setError("Please sign out and sign back in, then try again.");
      return;
    }
    setSendingVerification(true);
    try {
      await sendEmailVerification(fbUser);
      setSuccess(`Verification email sent to ${fbUser.email}. Open the link, then refresh this page.`);
    } catch (err: any) {
      setError(err?.message || "Failed to send verification email");
    } finally {
      setSendingVerification(false);
    }
  };

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const first = parsePersonName(firstName, "First name");
    if (!first.ok) {
      setError(first.error);
      return;
    }
    const last = parsePersonName(lastName, "Last name");
    if (!last.ok) {
      setError(last.error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: first.value, lastName: last.value }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess("Name updated successfully!");
        setIsEditingName(false);
        setFirstName(first.value);
        setLastName(last.value);
        setCurrentUser({ ...currentUser, displayName: data.displayName });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = await res.json();
        setError(data.error || "Failed to update name");
      }
    } catch (err) {
      console.error("Error updating name:", err);
      setError("Failed to update name");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateDob = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const parsed = parseDob(dob);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (!parsed.value) {
      setError("Date of birth is required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob: parsed.value }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess("Date of birth updated successfully!");
        setIsEditingDob(false);
        setCurrentUser({ ...currentUser, dob: data.dob || "" });
        setDob(data.dob || "");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update date of birth");
      }
    } catch (err) {
      console.error("Error updating date of birth:", err);
      setError("Failed to update date of birth");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdatePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const parsed = parsePhone(phone);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}/contact`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: parsed.value ?? "" }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess("Phone updated successfully!");
        setIsEditingPhone(false);
        setCurrentUser({ ...currentUser, phone: data.phone || "" });
        setPhone(data.phone || "");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to update phone");
      }
    } catch (err) {
      console.error("Error updating phone:", err);
      setError("Failed to update phone");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      setError("Please type DELETE to confirm");
      return;
    }

    setDeleting(true);
    setError("");

    try {
      const res = await fetch(`/api/users/${currentUser.id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        window.location.href = "/";
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete account");
        setDeleting(false);
      }
    } catch (err) {
      console.error("Error deleting account:", err);
      setError("Failed to delete account");
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg">
          {/* Header */}
          <div className="px-6 py-8 border-b border-gray-200">
            <h1 className="page-title">Account Settings</h1>
            <p className="mt-2 text-gray-600">Manage your account information</p>
          </div>

          {/* Messages */}
          {error && (
            <div className="mx-6 mt-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          {success && (
            <div className="mx-6 mt-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
              {success}
            </div>
          )}

          {/* Current Info */}
          <div className="px-6 py-6 border-b border-gray-200" style={{ marginTop: '60px' }}>
            <div className="space-y-3">
              {/* Name */}
              <div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "15px" }}>
                  <span
                    className="text-gray-600"
                    style={{ fontWeight: "600", paddingTop: isEditingName ? "6px" : 0 }}
                  >
                    Name:
                  </span>
                  {isEditingName ? (
                    <form onSubmit={handleUpdateName} style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <input
                            type="text"
                            id="firstName"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="input"
                            style={{ width: "160px" }}
                            disabled={saving}
                            required
                            autoFocus
                          />
                          <label
                            htmlFor="firstName"
                            className="text-gray-500"
                            style={{ fontSize: "12px" }}
                          >
                            First name
                          </label>
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <input
                            type="text"
                            id="lastName"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="input"
                            style={{ width: "160px" }}
                            disabled={saving}
                            required
                          />
                          <label
                            htmlFor="lastName"
                            className="text-gray-500"
                            style={{ fontSize: "12px" }}
                          >
                            Last name
                          </label>
                        </div>
                      </div>
                      <div className="flex gap-3" style={{ marginTop: "10px" }}>
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                          style={{
                            fontSize: "14px",
                            letterSpacing: "0.5px",
                            color: "var(--navy)",
                          }}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingName(false);
                            const parts = (currentUser.displayName || "").split(" ");
                            setFirstName(parts[0] || "");
                            setLastName(parts.slice(1).join(" ") || "");
                            setError("");
                          }}
                          disabled={saving}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                          style={{
                            marginLeft: "15px",
                            fontSize: "14px",
                            letterSpacing: "0.5px",
                            color: "var(--navy)",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="font-medium">
                        {currentUser.displayName || "Not set"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingName(true)}
                        className="p-1 rounded transition-colors"
                        style={{
                          color: "var(--navy)",
                          backgroundColor: "transparent",
                        }}
                        title="Edit name"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Email */}
              <div style={{ marginTop: "20px" }}>
                <span className="text-gray-600" style={{ fontWeight: "600" }}>
                  Email:
                </span>
                <span className="font-medium" style={{ marginLeft: "15px" }}>
                  {currentUser.email}
                </span>
                {currentUser.emailVerified ? (
                  <span className="text-gray-600" style={{ marginLeft: "10px" }}>
                    (verified)
                  </span>
                ) : (
                  <>
                    <span className="text-gray-600" style={{ marginLeft: "10px" }}>
                      (not verified)
                    </span>
                    <button
                      type="button"
                      onClick={() => void handleSendVerification()}
                      disabled={sendingVerification}
                      className="text-blue-700 hover:underline"
                      style={{
                        marginLeft: "10px",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                    >
                      {sendingVerification ? "Sending…" : "Send verification email"}
                    </button>
                  </>
                )}
              </div>

              {/* Date of Birth */}
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "15px" }}>
                  <span
                    className="text-gray-600"
                    style={{ fontWeight: "600", paddingTop: isEditingDob ? "6px" : 0 }}
                  >
                    Date of Birth:
                  </span>
                  {isEditingDob ? (
                    <form onSubmit={handleUpdateDob}>
                      <input
                        type="date"
                        id="dob"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="input"
                        style={{ width: "180px" }}
                        disabled={saving}
                        autoFocus
                      />
                      <div className="flex gap-3" style={{ marginTop: "10px" }}>
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                          style={{
                            fontSize: "14px",
                            letterSpacing: "0.5px",
                            color: "var(--navy)",
                          }}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingDob(false);
                            setDob(currentUser.dob || "");
                            setError("");
                          }}
                          disabled={saving}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                          style={{
                            marginLeft: "15px",
                            fontSize: "14px",
                            letterSpacing: "0.5px",
                            color: "var(--navy)",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="font-medium">{formatDobDisplay(currentUser.dob)}</span>
                      <button
                        type="button"
                        onClick={() => setIsEditingDob(true)}
                        className="p-1 rounded transition-colors"
                        style={{
                          color: "var(--navy)",
                          backgroundColor: "transparent",
                        }}
                        title="Edit date of birth"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Phone */}
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "15px" }}>
                  <span
                    className="text-gray-600"
                    style={{ fontWeight: "600", paddingTop: isEditingPhone ? "6px" : 0 }}
                  >
                    Phone:
                  </span>
                  {isEditingPhone ? (
                    <form onSubmit={handleUpdatePhone}>
                      <input
                        type="tel"
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="input"
                        style={{ width: "200px" }}
                        placeholder="e.g. (555) 123-4567"
                        disabled={saving}
                        autoFocus
                      />
                      <div className="flex gap-3" style={{ marginTop: "10px" }}>
                        <button
                          type="submit"
                          disabled={saving}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                          style={{
                            fontSize: "14px",
                            letterSpacing: "0.5px",
                            color: "var(--navy)",
                          }}
                        >
                          {saving ? "Saving..." : "Save Changes"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingPhone(false);
                            setPhone(currentUser.phone || "");
                            setError("");
                          }}
                          disabled={saving}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                          style={{
                            marginLeft: "15px",
                            fontSize: "14px",
                            letterSpacing: "0.5px",
                            color: "var(--navy)",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <span className="font-medium">
                        {currentUser.phone || "Not set"}
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingPhone(true)}
                        className="p-1 rounded transition-colors"
                        style={{
                          color: "var(--navy)",
                          backgroundColor: "transparent",
                        }}
                        title="Edit phone"
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Delete Account Section */}
          <div className="px-6 py-6">
            <div
              className="bg-red-50 border border-red-200 rounded-lg p-4"
              style={{ marginTop: "60px" }}
            >
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="link-danger"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-red-600 mb-4">Confirm Account Deletion</h3>
            <p className="text-gray-700 mb-4">
              This action <strong>cannot be undone</strong>. This will permanently delete your
              account and remove all your data from the system.
            </p>
            <p className="text-gray-700 mb-4">You will be removed from:</p>
            <ul className="list-disc list-inside text-gray-700 mb-4 space-y-1">
              <li>All teams you&apos;re a member of</li>
              <li>All leagues you&apos;re registered in</li>
              <li>Any admin roles you may have</li>
            </ul>
            <p className="text-gray-700 mb-4">
              Type <strong>DELETE</strong> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="input"
              style={{ width: "20%", marginBottom: "16px" }}
              placeholder="Type DELETE"
              disabled={deleting}
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== "DELETE"}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed hover:cursor-pointer"
                style={{ fontSize: "14px", letterSpacing: "0.5px", color: "#dc2626" }}
              >
                {deleting ? "Deleting..." : "Delete My Account"}
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                  setError("");
                }}
                disabled={deleting}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  marginLeft: "15px",
                  fontSize: "14px",
                  letterSpacing: "0.5px",
                  color: "var(--navy)",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
