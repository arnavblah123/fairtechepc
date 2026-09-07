import "server-only";
import { put } from "@vercel/blob";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";
import { ApiError } from "./api";

const LOCAL_DIR = path.join(process.cwd(), ".uploads");

/**
 * Store an image and return a URL. Uses Vercel Blob when BLOB_READ_WRITE_TOKEN is set,
 * otherwise falls back to local disk (dev only).
 */
export async function storeImage(buf: Buffer, ext: "jpg" | "png"): Promise<string> {
  const name = `${new Date().toISOString().slice(0, 10)}/${randomBytes(8).toString("hex")}.${ext}`;
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(name, buf, { access: "public", contentType: ext === "jpg" ? "image/jpeg" : "image/png" });
    return blob.url;
  }
  if (process.env.VERCEL) {
    throw new ApiError(500, "Photo storage is not connected. In Vercel: Storage → create/connect a Blob store, then Redeploy.");
  }
  const file = path.join(LOCAL_DIR, name.replace("/", "_"));
  await mkdir(LOCAL_DIR, { recursive: true });
  await writeFile(file, buf);
  return `/api/files/${path.basename(file)}`;
}
