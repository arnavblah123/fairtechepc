import "server-only";
import { put, del } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { ApiError } from "./api";

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export const NOT_CONNECTED =
  "Photo storage is not connected. In Vercel: Storage → create/connect a Blob store (tick Production), then Deployments → Redeploy.";

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
export async function storageStatus(): Promise<{ provider: "blob" | "local" | "none"; tokenPresent: boolean; ok: boolean; message: string }> {
  const tokenPresent = !!process.env.BLOB_READ_WRITE_TOKEN;
  if (tokenPresent) {
    try {
      const probe = await put(`probe/${randomBytes(6).toString("hex")}.txt`, "ok", { access: "public", contentType: "text/plain" });
      await del(probe.url).catch(() => undefined);
      return { provider: "blob", tokenPresent, ok: true, message: "Photo storage is connected and working." };
    } catch (e) {
      return { provider: "blob", tokenPresent, ok: false, message: blobProblem(e) };
    }
  }
  if (process.env.VERCEL) return { provider: "none", tokenPresent, ok: false, message: NOT_CONNECTED };
  return { provider: "local", tokenPresent, ok: true, message: "Local disk (development only)." };
}

/**
 * Store an image and return a URL. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise falls back to local disk (dev only).
 */
export async function storeImage(buf: Buffer, ext: "jpg" | "png"): Promise<string> {
  const name = `${new Date().toISOString().slice(0, 10)}/${randomBytes(8).toString("hex")}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const blob = await put(name, buf, { access: "public", contentType: ext === "jpg" ? "image/jpeg" : "image/png" });
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
