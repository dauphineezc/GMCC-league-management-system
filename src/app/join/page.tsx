import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getServerUser } from "@/lib/serverUser";
import JoinClient from "./joinClient";

export const dynamic = "force-dynamic";

function buildJoinReturnPath(params: { t?: string; code?: string }) {
  const q = new URLSearchParams();
  if (params.t) q.set("t", params.t);
  if (params.code) q.set("code", params.code);
  const qs = q.toString();
  return qs ? `/join?${qs}` : "/join";
}

export default async function JoinPage({
  searchParams,
}: {
  searchParams: { t?: string; code?: string };
}) {
  const user = await getServerUser();
  if (!user) {
    const next = buildJoinReturnPath({
      t: searchParams.t,
      code: searchParams.code,
    });
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <Suspense fallback={null}>
      <JoinClient />
    </Suspense>
  );
}
