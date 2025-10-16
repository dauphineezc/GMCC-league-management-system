// Redirect to new admins page
// This route is deprecated - all users now use /admins
import { redirect } from "next/navigation";

export default function SuperadminAdminsRedirect() {
  redirect("/admins");
}
