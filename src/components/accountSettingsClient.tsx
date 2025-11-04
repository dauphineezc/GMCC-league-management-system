// /src/components/accountSettingsClient.tsx
"use client";

import { useState } from "react";

type UserData = {
  id: string;
  email: string | null;
  displayName: string;
};

type Props = {
  user: UserData;
};

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
  
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleUpdateName = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    
    if (!firstName.trim() || !lastName.trim()) {
      setError("Both first and last name are required");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/users/${currentUser.id}/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess("Name updated successfully!");
        setIsEditingName(false);
        setCurrentUser({ ...currentUser, displayName: data.displayName });
        // Refresh the page to update navbar
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
        // Account deleted, redirect to home
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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
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
              <div>
                <span className="text-gray-600" style={{ fontWeight: '600' }}>Name:</span>
                <span className="font-medium" style={{ marginLeft: '15px' }}>{currentUser.displayName || "Not set"}</span>
                {!isEditingName && (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--navy)', backgroundColor: 'transparent', marginLeft: '8px' }}
                    title="Edit name"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="m18.5 2.5 3 3L12 15l-4 1 1-4Z" />
                    </svg>
                  </button>
                )}
              </div>
              <div style={{ marginTop: '20px' }}>
                <span className="text-gray-600" style={{ fontWeight: '600' }}>Email:</span>
                <span className="font-medium" style={{ marginLeft: '15px' }}>{currentUser.email}</span>
              </div>
            </div>
          </div>

          {/* Edit Name Section */}
          {isEditingName && (
            <div className="px-6 py-6 border-b border-gray-200">
              <h2 className="section-title" style={{ fontSize: '20px', letterSpacing: '0.5px', marginBottom: '10px' }}>Edit Name</h2>
              <form onSubmit={handleUpdateName} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                      First Name:
                    </label>
                    <input
                      type="text"
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input"
                      style={{ marginLeft: '15px', width: '40%' }}
                      disabled={saving}
                      required
                    />
                  </div>
                  <div>
                    <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                      Last Name:
                    </label>
                    <input
                      type="text"
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input"
                      style={{ marginLeft: '17px', marginTop: '10px', width: '40%' }}
                      disabled={saving}
                      required
                    />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ fontSize: '14px', letterSpacing: '0.5px', color: 'var(--navy)' }}
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingName(false);
                      // Reset to current values
                      const nameParts = (currentUser.displayName || "").split(" ");
                      setFirstName(nameParts[0] || "");
                      setLastName(nameParts.slice(1).join(" ") || "");
                      setError("");
                    }}
                    disabled={saving}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ marginLeft: '15px', fontSize: '14px', letterSpacing: '0.5px', color: 'var(--navy)' }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Delete Account Section */}
          <div className="px-6 py-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4" style={{ marginTop: '60px' }}>
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
              This action <strong>cannot be undone</strong>. This will permanently delete your account 
              and remove all your data from the system.
            </p>
            <p className="text-gray-700 mb-4">
              You will be removed from:
            </p>
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
              style={{ width: '20%', marginBottom: '16px' }}
              placeholder="Type DELETE"
              disabled={deleting}
            />
            <div className="flex gap-3">
              <button
                onClick={handleDeleteAccount}
                disabled={deleting || deleteConfirmText !== "DELETE"}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontSize: '14px', letterSpacing: '0.5px', color: '#dc2626' }}
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
                style={{ marginLeft: '15px', fontSize: '14px', letterSpacing: '0.5px', color: 'var(--navy)' }}
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

