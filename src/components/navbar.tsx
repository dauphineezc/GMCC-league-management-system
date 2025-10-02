// /src/components/navbar.tsx
import Link from "next/link";
import Image from "next/image";
import { getServerUser } from "@/lib/serverUser";

export const dynamic = "force-dynamic"; // <-- ensure navbar re-renders per request

export default async function Navbar() {
  const user = await getServerUser();
  const isSignedIn = !!user;
  const isSuper = !!user?.superadmin;
  const isAdmin = isSuper || Array.isArray(user?.leagueAdminOf);

  return (
    <nav className="nav-court-bg">
      <div className="nav-inner">
        <Link href="/" className="nav-left nav-logo">
          <Image src="/gmcc-ribbon-logo.png" alt="Company" width={140} height={80} priority />
          <span className="nav-title">League Management System</span>
        </Link>

        <div className="nav-links">
          {/* SUPER ADMIN */}
          {isSuper && (
            <>
              <Link className="nav-link" href="/superadmin">Home</Link>
              <Link className="nav-link" href="/superadmin/teams">Teams</Link>
              <Link className="nav-link" href="/superadmin/leagues">Leagues</Link>
              <Link className="nav-link" href="/superadmin/players">Players</Link>
              <Link className="nav-link" href="/superadmin/admins">Admins</Link>
            </>
          )}

          {/* ADMIN (non-super) */}
          {!isSuper && isAdmin && (
            <>
              <Link className="nav-link" href="/admin#public-leagues">Leagues</Link>
              <Link className="nav-link" href="/admin#leagues">My Leagues</Link>
            </>
          )}

          {/* PLAYER (signed-in, not admin/super) */}
          {!isSuper && !isAdmin && isSignedIn && (
            <>
              <Link className="nav-link" href="/player#public-leagues">Leagues</Link>
              <Link className="nav-link" href="/player#teams">My Teams</Link>
            </>
          )}

          {/* PUBLIC (signed-out) */}
          {!isSignedIn && <Link className="nav-link" href="/#public-leagues">Leagues</Link>}

          {/* ACCOUNT MENU */}
          {isSignedIn ? (
            <details className="account">
              <summary className="account-trigger nav-pill">
                <span className="chev">▾</span>
                <span>My Account</span>
              </summary>
              <div className="account-menu">
                <Link className="block px-3 py-2 hover:bg-gray-50" href="/account">Settings</Link>
                <Link className="block px-3 py-2 hover:bg-gray-50" href="/logout">Sign out</Link>
              </div>
            </details>
          ) : (
            <details className="account">
              <summary className="account-trigger nav-pill">
                <span className="chev">▾</span>
                <span>My Account</span>
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