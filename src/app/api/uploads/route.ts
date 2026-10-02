import { withAuth, ok, ApiError } from "@/lib/api";
import { storeImage, storageStatus } from "@/lib/storage";
import { prisma } from "@/lib/prisma";

const MAX_BYTES = 1.5 * 1024 * 1024; // client compresses to ~200KB; hard stop well below Vercel's limit

/** Generic image upload (multipart form, field "file"). Returns { url }. */
export const POST = withAuth("photo.upload", async ({ req }) => {
  const form = await req.formData().catch(() => {
    throw new ApiError(400, "Send multipart form data with a 'file' field");
  });
  const file = form.get("file");
  if (!(file instanceof File)) throw new ApiError(400, "Missing photo");
  if (file.size === 0) throw new ApiError(400, "Empty photo");
  if (file.size > MAX_BYTES) throw new ApiError(400, "Photo too large. Please retry (it should compress automatically).");
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    if (/heic|heif/i.test(file.type) || /\.hei[cf]$/i.test(file.name)) {
      throw new ApiError(400, "This phone saves photos as HEIC, which the browser could not convert. iPhone: Settings → Camera → Formats → Most Compatible, then retry.");
    }
    throw new ApiError(400, `Only JPEG/PNG photos are allowed (got ${file.type || "unknown type"})`);
  }
  const url = await storeImage(Buffer.from(await file.arrayBuffer()), file.type === "image/png" ? "png" : "jpg");
  return ok({ url }, 201);
});

/**
 * Superadmin self-test: is photo storage reachable from THIS deployment?
 * Writes and deletes a tiny probe file, and says which deployment answered so
 * a stale deploy (token added, never redeployed) is obvious.
 */
export const GET = withAuth("user.manage", async () => {
  const status = await storageStatus();
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null;
  const photos = await prisma.sitePhoto.count().catch(() => 0);
  return ok({ ...status, deployment: sha, env: process.env.VERCEL_ENV ?? "local", photosStored: photos });
});
