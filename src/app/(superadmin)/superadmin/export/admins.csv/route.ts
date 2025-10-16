// Redirect to new export route
import { redirect } from "next/navigation";

export function GET() {
  redirect("/export/admins.csv");
}
