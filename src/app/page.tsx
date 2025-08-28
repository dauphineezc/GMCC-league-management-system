import { redirect } from "next/navigation";
export default function Root() {
  redirect("/home"); // single neutral entry point
}