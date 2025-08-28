import Link from "next/link";
import Image from "next/image";
import { getSession, hasRole } from "@/lib/auth";

export default async function Navbar() {
  const { roles } = await getSession();
  const showAdmin = hasRole(roles, "admin");
  const showPlayer = hasRole(roles, "player");

  return (
    <nav className="nav-court-bg">
      <div className="nav-inner">
        <Link href="/" className="nav-left nav-logo">
          <Image src="/gmcc-ribbon-logo.png" alt="Company" width={140} height={80} priority />
          <span className="nav-title">League Management System</span>
        </Link>
        <div className="nav-links">
          <Link className="nav-link" href="/leagues">Leagues</Link>
          {showPlayer && <Link className="nav-link" href="/player">My Teams</Link>}
          {showAdmin && <Link className="nav-link" href="/admin">My Leagues</Link>}
          <Link className="nav-link nav-pill" href="/account">My Account</Link>
        </div>
      </div>
    </nav>
  );
}