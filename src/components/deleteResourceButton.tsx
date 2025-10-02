"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Kind = "team" | "league";

type Props = {
  /** "team" or "league" */
  kind: Kind;
  /** ID of the team/league to delete */
  id: string;
  /** Where to go after the deletion succeeds */
  redirectTo: string;
  /** Optional display name used in the confirm message */
  name?: string;
  /** Override the default confirm message */
  confirmMessage?: string;
  /** Visual style: "link" (uses .link-danger) or "button" (.btn .btn--danger) */
  variant?: "link" | "button";
  /** Extra class names */
  className?: string;
  /** Optional custom label inside the button */
  children?: React.ReactNode;
};

export default function DeleteResourceButton({
  kind,
  id,
  redirectTo,
  name,
  confirmMessage,
  variant = "link",
  className,
  children,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const path = kind === "team" ? `/api/teams/${id}` : `/api/leagues/${id}`;
  const label = children ?? (kind === "team" ? "Delete Team" : "Delete League");

  const msg =
    confirmMessage ??
    `Are you sure you want to delete this ${kind}${
      name ? ` “${name}”` : ""
    }? This cannot be undone.`;

  async function onClick() {
    if (busy) return;
    if (!confirm(msg)) return;

    try {
      setBusy(true);
      const res = await fetch(path, { method: "DELETE", credentials: "include" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        alert(json?.error ?? `Failed to delete ${kind}.`);
        return;
      }

      // Navigate away and ensure fresh data elsewhere
      router.replace(redirectTo || "/");
      router.refresh();
    } catch {
      alert(`Failed to delete ${kind}.`);
    } finally {
      setBusy(false);
    }
  }

  const baseClass =
    variant === "button" ? "btn btn--danger" : "link-danger";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-disabled={busy}
      className={`${baseClass}${className ? ` ${className}` : ""}`}
    >
      {busy ? "Deleting…" : label}
    </button>
  );
}

/* Convenience wrappers if you prefer */
export function DeleteTeamButton(
  props: Omit<Props, "kind">
) {
  return <DeleteResourceButton kind="team" {...props} />;
}

export function DeleteLeagueButton(
  props: Omit<Props, "kind">
) {
  return <DeleteResourceButton kind="league" {...props} />;
}