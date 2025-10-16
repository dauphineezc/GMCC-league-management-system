// Redirect to new players page
// This route is deprecated - all users now use /players
import { redirect } from "next/navigation";

export default function SuperadminPlayersRedirect() {
  redirect("/players");
}
