export function DbMissing({ error }: { error?: string }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-slate-100 px-5 py-10">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow">
        <h1 className="text-xl font-bold text-red-700">Database not connected</h1>
        <p className="mt-2 text-sm text-slate-700">The app is deployed but has no database yet. In Vercel:</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-700">
          <li>Open your project → <b>Storage</b> tab → <b>Create Database</b> → choose <b>Neon</b> → Continue.</li>
          <li>Go to <b>Settings → Environment Variables</b> and make sure <code>SESSION_SECRET</code> exists.</li>
          <li>Go to <b>Deployments</b> → the three dots on the latest one → <b>Redeploy</b>.</li>
          <li>Reload this page.</li>
        </ol>
        {error && <pre className="mt-3 max-h-32 overflow-auto rounded bg-slate-50 p-2 text-[11px] text-slate-500">{error}</pre>}
      </div>
    </main>
  );
}
