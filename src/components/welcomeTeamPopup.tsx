"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type Props = {
  teamName: string;
  webtracUrl?: string;
};

export default function WelcomeTeamPopup({ teamName, webtracUrl = "https://register.greatermidland.org/webtrac/web/search.html?category=ADULT&module=AR&subtype=LEAGS&display=Detail" }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [show, setShow] = useState(false);
  const [action, setAction] = useState<"created" | "joined" | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const created = searchParams?.get("created") === "true";
    const joined = searchParams?.get("joined") === "true";

    if (created || joined) {
      setAction(created ? "created" : "joined");
      
      // Show popup after 2 seconds
      const timer = setTimeout(() => {
        setShow(true);
        // Remove query params from URL after showing
        const newUrl = window.location.pathname;
        router.replace(newUrl, { scroll: false });
      }, 2000);

      return () => {
        clearTimeout(timer);
      };
    }
  }, [mounted, searchParams, router]);

  const handleClose = () => {
    setShow(false);
    // Remove query params from URL
    const newUrl = window.location.pathname;
    router.replace(newUrl, { scroll: false });
  };

  // Lock scroll when open
  useEffect(() => {
    if (!mounted) return;
    const prev = document.body.style.overflow;
    if (show) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show, mounted]);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    if (show) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [show]);

  if (!mounted || !show || !action) return null;

  const message = action === "created" 
    ? `Hello! You just created the team ${teamName}!`
    : `Hello! You just joined the team ${teamName}!`;

  const overlay = (
    <div
      className="popup-backdrop"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(0,0,0,0.35)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
      }}
    >
      <div
        className="card"
        role="document"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "white",
          borderRadius: "8px",
          maxWidth: "500px",
          width: "100%",
          padding: "24px",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          position: "relative",
        }}
      >
        <button
          onClick={handleClose}
          style={{
            position: "absolute",
            top: "16px",
            right: "16px",
            background: "none",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            padding: "0",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "4px",
            color: "#666",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#f0f0f0";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          ✕
        </button>

        <h2
          style={{
            margin: "0 0 16px 0",
            fontSize: "24px",
            fontWeight: 400,
            color: "var(--navy)",
          }}
        >
          Welcome!
        </h2>

        <p
          style={{
            margin: "0 0 20px 0",
            fontSize: "16px",
            color: "var(--text)",
            lineHeight: 1.5,
          }}
        >
          {message} In order to play this season, you must register and pay your league fee(s) on WebTrac.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            className="btn btn--outline btn--md"
            onClick={handleClose}
            style={{ minWidth: "100px" }}
          >
            Close
          </button>
          <a
            href={webtracUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn--primary btn--md"
            style={{ minWidth: "150px", textAlign: "center" }}
          >
            Go to WebTrac →
          </a>
        </div>
      </div>
    </div>
  );

  return createPortal(overlay, document.body);
}

