import "server-only";
import { put, del, get, type PutCommandOptions } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { ApiError } from "./api";

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

export const NOT_CONNECTED =
  "Photo storage is not connected. In Vercel: Storage → create a Blob store → Projects → Connect to this project (tick Production), then Deployments → Redeploy.";

/** Pathname prefix for blobs served through the app (private stores). */
export const PROXY_PREFIX = "/api/blob/";

/**
 * How this deployment can talk to Vercel Blob.
 *  - token: the classic BLOB_READ_WRITE_TOKEN (any variable holding a vercel_blob_rw_ token).
 *  - oidc:  the current Vercel model — the store id is in BLOB_STORE_ID and the SDK
 *           authenticates with the deployment's own Vercel OIDC token, no secret needed.
 */
export type BlobCreds = { mode: "token"; name: string; token: string } | { mode: "oidc"; storeId: string } | null;

export function blobCreds(): BlobCreds {
  const clean = (v: string | undefined) => (v ?? "").trim().replace(/^["']|["']$/g, "");
  const direct = clean(process.env.BLOB_READ_WRITE_TOKEN);
  if (direct) return { mode: "token", name: "BLOB_READ_WRITE_TOKEN", token: direct };
  for (const [name, value] of Object.entries(process.env)) {
    const v = clean(value);
    if (v.startsWith("vercel_blob_rw_")) return { mode: "token", name, token: v };
  }
  const storeId = clean(process.env.BLOB_STORE_ID);
  if (storeId) return { mode: "oidc", storeId };
  return null;
}

function sdkOptions(c: Exclude<BlobCreds, null>): { token?: string; storeId?: string } {
  return c.mode === "token" ? { token: c.token } : { storeId: c.storeId };
}

type Access = "public" | "private";
/** Remembered after the first upload so every later upload goes straight through. */
let detectedAccess: Access | null = (process.env.BLOB_ACCESS as Access | undefined) ?? null;

/** Turn a Vercel Blob failure into something a person can act on from the phone. */
export function blobProblem(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/oidc/i.test(msg) || /OIDC token/i.test(msg)) {
    return "This deployment has no Vercel OIDC token, so it cannot reach the Blob store. In Vercel: Project → Settings → Security → \"Secure Backend Access with OIDC Federation\" → set to Enabled (issuer: Team) → Save → Deployments → Redeploy.";
  }
  if (/token|unauthorized|forbidden|403|401/i.test(msg)) {
    return "Blob store refused the credentials. In Vercel: Storage → open the store → Projects → make sure this project is connected (Production ticked) → Redeploy.";
  }
  if (/not found|does not exist|store/i.test(msg)) return "The Blob store this deployment points to no longer exists. Create a new one in Vercel Storage, connect it under Projects, then Redeploy.";
  if (/suspended/i.test(msg)) return "The Blob store is suspended in Vercel. Check Storage → the store's status.";
  return `Photo storage error: ${msg}`;
}

const isAccessMismatch = (e: unknown) => /access|private|public/i.test(e instanceof Error ? e.message : String(e));

/** Upload with whichever access mode the store accepts, remembering the answer. */
async function putWithAccess(pathname: string, body: Buffer | string, contentType: string, creds: Exclude<BlobCreds, null>) {
  const order: Access[] = detectedAccess ? [detectedAccess] : ["private", "public"];
  let lastErr: unknown = null;
  for (const access of order) {
    try {
      const opts = { access, contentType, addRandomSuffix: false, ...sdkOptions(creds) } as PutCommandOptions;
      const blob = await put(pathname, body, opts);
      detectedAccess = access;
      return { blob, access };
    } catch (e) {
      lastErr = e;
      if (!isAccessMismatch(e) || order.length === 1) throw e;
    }
  }
  throw lastErr;
}

/**
 * Store an image and return the URL to put in the database. Public stores give a
 * direct blob URL; private stores give an app URL that streams the blob to
 * logged-in users only. Locally (no Blob), files go to disk.
 */
export async function storeImage(buf: Buffer, ext: "jpg" | "png"): Promise<string> {
  const name = `${new Date().toISOString().slice(0, 10)}/${randomBytes(8).toString("hex")}.${ext}`;
  const creds = blobCreds();
  if (creds) {
    try {
      const { blob, access } = await putWithAccess(name, buf, ext === "jpg" ? "image/jpeg" : "image/png", creds);
      return access === "public" ? blob.url : `${PROXY_PREFIX}${blob.pathname}`;
    } catch (e) {
      throw new ApiError(500, blobProblem(e));
    }
  }
  if (process.env.VERCEL) throw new ApiError(500, NOT_CONNECTED);
  const file = path.join(LOCAL_DIR, name.replace("/", "_"));
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(file, buf);
  return `/api/files/${path.basename(file)}`;
}

/** Stream a private blob (by pathname) for the proxy route. Null when it does not exist. */
export async function openPrivateBlob(pathname: string, ifNoneMatch?: string | null) {
  const creds = blobCreds();
  if (!creds) return null;
  const r = await get(pathname, { access: "private", ifNoneMatch: ifNoneMatch ?? undefined, ...sdkOptions(creds) });
  return r;
}

/** For the self-test: what each Blob-looking variable holds, without revealing it. */
function blobVariableReport(): string {
  const rows = Object.entries(process.env)
    .filter(([k]) => /BLOB|READ_WRITE_TOKEN|VERCEL_OIDC/i.test(k))
    .map(([k, v]) => {
      const val = (v ?? "").trim();
      if (!val) return `${k} = EMPTY`;
      return `${k} = ${val.length} chars, starts "${val.slice(0, 12)}"`;
    });
  return rows.length ? ` Variables seen: ${rows.join("; ")}.` : " No Blob-related variable is visible to this deployment.";
}

export type StorageStatus = {
  provider: "blob" | "local" | "none";
  credsPresent: boolean;
  credsLabel: string | null;
  access: Access | null;
  ok: boolean;
  message: string;
};

/** What the running deployment can do: writes and deletes a probe file. */
export async function storageStatus(): Promise<StorageStatus> {
  const creds = blobCreds();
  const credsLabel = creds ? (creds.mode === "token" ? `token in ${creds.name}` : `Vercel OIDC + store ${creds.storeId}`) : null;
  if (creds) {
    try {
      const { blob, access } = await putWithAccess(`probe/${randomBytes(6).toString("hex")}.txt`, "ok", "text/plain", creds);
      await del(blob.url, sdkOptions(creds)).catch(() => undefined);
      return { provider: "blob", credsPresent: true, credsLabel, access, ok: true, message: `Photo storage is connected and working (${credsLabel}, ${access} store).` };
    } catch (e) {
      return { provider: "blob", credsPresent: true, credsLabel, access: detectedAccess, ok: false, message: blobProblem(e) + blobVariableReport() };
    }
  }
  if (process.env.VERCEL) return { provider: "none", credsPresent: false, credsLabel, access: null, ok: false, message: NOT_CONNECTED + blobVariableReport() };
  return { provider: "local", credsPresent: false, credsLabel: "local disk", access: null, ok: true, message: "Local disk (development only)." };
}
