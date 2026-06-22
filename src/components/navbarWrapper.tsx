// /src/components/navbarWrapper.tsx
import { getServerUser } from "@/lib/serverUser";
import Navbar from "./navbar";
import { hasManagedLeagues } from "@/lib/kvHelpers";

export default async function NavbarWrapper() {
  const user = await getServerUser();

  let hasAdminLeagues = false;
  if (user && !user.superadmin) {
    hasAdminLeagues = await hasManagedLeagues(user);
  }

  return <Navbar user={user} hasAdminLeagues={hasAdminLeagues} />;
}
