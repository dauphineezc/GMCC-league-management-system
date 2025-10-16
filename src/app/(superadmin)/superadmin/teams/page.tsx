// Redirect to new unified teams page
// This route is deprecated - all users now use /teams
import { redirect } from "next/navigation";

export default function SuperadminTeamsRedirect() {
  redirect("/teams");
}
