export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./LoginForm";
import { DbMissing } from "@/components/DbMissing";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!process.env.DATABASE_URL) return <DbMissing />;
  try {
    if ((await prisma.user.count()) === 0) redirect("/setup");
  } catch (e) {
    if (e && typeof e === "object" && "digest" in e) throw e; // Next redirect
    return <DbMissing error={e instanceof Error ? e.message : String(e)} />;
  }
  const user = await getSessionUser();
  if (user) redirect("/");
  const { next } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-brand-dark px-5 py-10">
      <div className="mb-8 text-center text-white">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-brand-dark">FT</div>
        <h1 className="text-2xl font-bold">Fairtech Site Manager</h1>
        <p className="text-sm opacity-80">फेयरटेक साइट मैनेजर</p>
      </div>
      <LoginForm next={next} />
    </main>
  );
}
