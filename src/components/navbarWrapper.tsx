// /src/components/navbarWrapper.tsx
import { getServerUser } from "@/lib/serverUser";
import Navbar from "./navbar";

export const dynamic = "force-dynamic"; // <-- ensure navbar re-renders per request

export default async function NavbarWrapper() {
  const user = await getServerUser();
  
  return <Navbar user={user} />;
}

