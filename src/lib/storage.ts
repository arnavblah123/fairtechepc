import "server-only";
import { put, del } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { ApiError } from "./api";

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export const NOT_CONNECTED =
  "Photo storage is not connected. In Vercel: Storage → create/connect a Blob store (tick Production), then Deployments → Redeploy.";

/**
 * Vercel names the Blob token after the store when it is connected with a
 * prefix (BILLS_STORE_READ_WRITE_TOKEN for a store called bills-store), so we
 * accept any variable that holds a Blob read-write token, not just the default.
 */
export function blobToken(): { name: string; token: string } | null {
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");
  const direct = clean(process.env.BLOB_READ_WRITE_TOKEN);
  if (direct) return { name: "BLOB_READ_WRITE_TOKEN", token: direct };
  for (const [name, value] of Object.entries(process.env)) {
    const v = clean(value);
    if (name.endsWith("READ_WRITE_TOKEN") && v.startsWith("vercel_blob_rw_")) return { name, token: v };
  }
  return null;
}

/** For the self-test: what each Blob-looking variable holds, without revealing it. */
function blobVariableReport(): string {
  const rows = Object.entries(process.env)
    .filter(([k]) => /BLOB|READ_WRITE_TOKEN/i.test(k))
    .map(([k, v]) => {
      const val = (v ?? "").trim();
      if (!val) return `${k} = EMPTY`;
      return `${k} = ${val.length} characters, starts "${val.slice(0, 15)}"`;
    });
  return rows.length ? ` Variables seen: ${rows.join("; ")}.` : " No Blob-related variable is visible to this deployment.";
}

/** Turn a Vercel Blob failure into something a person can act on from the phone. */
export function blobProblem(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/token|access|unauthorized|403|401/i.test(msg)) {
    return "Photo storage token is wrong or belongs to another store. In Vercel: Storage → open the Blob store → Connect to this project (Production ticked) → Redeploy.";
  }
  if (/not found|store/i.test(msg)) return "The Blob store this token points to no longer exists. Create a new one in Vercel Storage, connect it, then Redeploy.";
  if (/suspended/i.test(msg)) return "The Blob store is suspended in Vercel. Check Storage → the store's status.";
  return `Photo storage error: ${msg}`;
}

/** What the running deployment can see. Used by the storage self-test. */
export async function storageStatus(): Promise<{ provider: "blob" | "local" | "none"; tokenPresent: boolean; tokenName: string | null; ok: boolean; message: string }> {
  const t = blobToken();
  const tokenPresent = !!t;
  const tokenName = t?.name ?? null;
  if (t) {
    try {
      const probe = await put(`probe/${randomBytes(6).toString("hex")}.txt`, "ok", { access: "public", contentType: "text/plain", token: t.token });
      await del(probe.url, { token: t.token }).catch(() => undefined);
      return { provider: "blob", tokenPresent, tokenName, ok: true, message: `Photo storage is connected and working (using ${t.name}).` };
    } catch (e) {
      return { provider: "blob", tokenPresent, tokenName, ok: false, message: blobProblem(e) };
    }
  }
  const hint = blobVariableReport();
  const empty = "BLOB_READ_WRITE_TOKEN" in process.env && !(process.env.BLOB_READ_WRITE_TOKEN ?? "").trim();
  const lead = empty
    ? "BLOB_READ_WRITE_TOKEN exists for this environment but its value is EMPTY. In Vercel: Storage → open the Blob store → copy the token shown under the project's connection (starts with vercel_blob_rw_) → Settings → Environment Variables → edit BLOB_READ_WRITE_TOKEN for Production and paste it → Redeploy."
    : NOT_CONNECTED;
  if (process.env.VERCEL) return { provider: "none", tokenPresent, tokenName, ok: false, message: lead + hint };
  return { provider: "local", tokenPresent, tokenName, ok: true, message: "Local disk (development only)." };
}

/**
 * Store an image and return a URL. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise falls back to local disk (dev only).
 */
export async function storeImage(buf: Buffer, ext: "jpg" | "png"): Promise<string> {
  const name = `${new Date().toISOString().slice(0, 10)}/${randomBytes(8).toString("hex")}.${ext}`;
  const blob_ = blobToken();
  if (blob_) {
    try {
      const blob = await put(name, buf, { access: "public", contentType: ext === "jpg" ? "image/jpeg" : "image/png", token: blob_.token });
      return blob.url;
    } catch (e) {
      throw new ApiError(500, blobProblem(e));
    }
  }
  if (process.env.VERCEL) {
    throw new ApiError(500, NOT_CONNECTED);
  }
  const file = path.join(LOCAL_DIR, name.replace("/", "_"));
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(file, buf);
  return `/api/files/${path.basename(file)}`;
}
