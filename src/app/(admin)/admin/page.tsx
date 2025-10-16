// Redirect to unified home page
// This route is deprecated - all users now use /
import { redirect } from "next/navigation";

export default function AdminRedirect() {
  redirect("/");
}
