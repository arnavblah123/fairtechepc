import { withAuth, ok, ApiError } from "@/lib/api";
import { storeImage } from "@/lib/storage";

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
  if (!["image/jpeg", "image/png"].includes(file.type)) throw new ApiError(400, "Only JPEG/PNG photos are allowed");
  const url = await storeImage(Buffer.from(await file.arrayBuffer()), file.type === "image/png" ? "png" : "jpg");
  return ok({ url }, 201);
});
