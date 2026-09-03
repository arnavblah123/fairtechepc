export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./SetupForm";
import { DbMissing } from "@/components/DbMissing";

export default async function SetupPage() {
  if (!process.env.DATABASE_URL) return <DbMissing />;
  let count = 0;
  try {
    count = await prisma.user.count();
  } catch (e) {
    return <DbMissing error={e instanceof Error ? e.message : String(e)} />;
  }
  if (count > 0) redirect("/login");
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-brand-dark px-5 py-10">
      <div className="mb-6 text-center text-white">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-2xl font-black text-brand-dark">FT</div>
        <h1 className="text-2xl font-bold">Welcome! One-time setup</h1>
        <p className="text-sm opacity-80">Create your superadmin account. This page disappears afterwards.</p>
      </div>
      <SetupForm />
    </main>
  );
}
