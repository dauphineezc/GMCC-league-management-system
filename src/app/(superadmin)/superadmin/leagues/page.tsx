// Redirect to new unified leagues list page
// This route is deprecated - all users now use /leagues
import { redirect } from "next/navigation";

export default function SuperadminLeaguesRedirect() {
  redirect("/leagues");
}
