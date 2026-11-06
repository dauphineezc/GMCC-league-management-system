// /src/app/logout/page.tsx
import SignOutButton from "@/components/signOutButton";

// Requires a click: signing out revokes every session, so a link alone must not trigger it.
export default function LogoutPage() {
  return (
    <main className="p-6" style={{ display: "grid", gap: 12, justifyItems: "start" }}>
      <p>Sign out of the League Management System on all your devices?</p>
      <SignOutButton className="btn btn--primary" />
    </main>
  );
}
