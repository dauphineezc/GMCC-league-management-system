// /src/components/navbar.tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type NavbarProps = {
  user: any;
};

export default function Navbar({ user }: NavbarProps) {
  const [accountOpen, setAccountOpen] = useState(false);
  const isSignedIn = !!user;
  const isSuper = !!user?.superadmin;
  const isAdmin = isSuper || Array.isArray(user?.leagueAdminOf);

  return (
    <nav className="nav-court-bg">
      <div className="nav-inner">
        <Link href="/" className="nav-left nav-logo">
          <Image 
            src="/gmcc-ribbon-logo.png" 
            alt="Company" 
            width={140} 
            height={80} 
            priority 
            style={{ maxWidth: '100%', height: 'auto' }}
          />
          <span className="nav-title">League Management System</span>
        </Link>

        <div className="nav-links">
          {/* SUPER ADMIN */}
          {isSuper && (
            <>
              <Link className="nav-link" href="/">Home</Link>
              <Link className="nav-link" href="/teams">Teams</Link>
              <Link className="nav-link" href="/leagues">Leagues</Link>
              <Link className="nav-link" href="/players">Players</Link>
              <Link className="nav-link" href="/admins">Admins</Link>
            </>
          )}

          {/* ADMIN (non-super) */}
          {!isSuper && isAdmin && (
            <>
              <Link className="nav-link" href="/#public-leagues">Leagues</Link>
              <Link className="nav-link" href="/#leagues">My Leagues</Link>
            </>
          )}

          {/* PLAYER (signed-in, not admin/super) */}
          {!isSuper && !isAdmin && isSignedIn && (
            <>
              <Link className="nav-link" href="/#public-leagues">Leagues</Link>
              <Link className="nav-link" href="/#teams">My Teams</Link>
            </>
          )}

          {/* PUBLIC (signed-out) */}
          {!isSignedIn && <Link className="nav-link" href="/#public-leagues">Leagues</Link>}

          {/* ACCOUNT MENU */}
          {isSignedIn ? (
            <details className="account" open={accountOpen} onToggle={(e: any) => setAccountOpen(e.target.open)}>
              <summary className="account-trigger nav-pill">
                <span>My Account</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  style={{
                    marginLeft: "4px",
                    verticalAlign: "middle",
                    transition: "transform 0.2s ease",
                    transform: accountOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </summary>
              <div className="account-menu">
                <Link className="block px-3 py-2 hover:bg-gray-50" href="/account">Settings</Link>
                <Link className="block px-3 py-2 hover:bg-gray-50" href="/logout">Sign out</Link>
              </div>
            </details>
          ) : (
            <details className="account" open={accountOpen} onToggle={(e: any) => setAccountOpen(e.target.open)}>
              <summary className="account-trigger nav-pill">
                <span>My Account</span>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                  style={{
                    marginLeft: "4px",
                    verticalAlign: "middle",
                    transition: "transform 0.2s ease",
                    transform: accountOpen ? "rotate(180deg)" : "rotate(0deg)",
                  }}
                >
                  <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" />
                </svg>
              </summary>
              <div className="account-menu">
                <Link className="block px-3 py-2 hover:bg-gray-50" href="/login">Sign in</Link>
              </div>
            </details>
          )}
        </div>
      </div>
    </nav>
  );
}