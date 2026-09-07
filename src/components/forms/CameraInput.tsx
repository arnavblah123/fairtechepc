"use client";
import { useRef, useState } from "react";
import { Bi } from "@/components/ui/Bi";
import { Spinner } from "@/components/ui/Button";

export type CapturedPhoto = { url: string; latitude: number; longitude: number; accuracyM: number };

/**
 * Live camera capture (capture="environment", no gallery), client-side compression to
 * max 1280px / ~200KB JPEG, geotag from the browser Geolocation API.
 * Rejects when location is denied or accuracy is worse than 100 m (per spec).
 */
export function CameraInput({
  label,
  hi,
  onCaptured,
  requireGeo = true,
  preview,
}: {
  label: string;
  hi?: string;
  onCaptured: (p: CapturedPhoto) => void;
  requireGeo?: boolean;
  preview?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);

  async function handle(file: File) {
    setBusy(true);
    setError(null);
    try {
      // Location first so a denial fails fast, before any upload.
      let geo = { latitude: 0, longitude: 0, accuracyM: 0 };
      if (requireGeo) {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 }),
        ).catch(() => {
          throw new Error("Location permission is required. Turn on GPS and allow location. / लोकेशन चालू करें और अनुमति दें");
        });
        if (pos.coords.accuracy > 100) {
          throw new Error(`Location accuracy is ${Math.round(pos.coords.accuracy)} m (needs 100 m or better). Move to open sky and retry. / खुले में जाकर दोबारा लें`);
        }
        geo = { latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracyM: pos.coords.accuracy };
      }

      const blob = await compress(file);
      const form = new FormData();
      form.append("file", blob, "photo.jpg");
      const res = await fetch("/api/uploads", { method: "POST", body: form, credentials: "same-origin" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Upload failed");
      setLocalPreview(URL.createObjectURL(blob));
      onCaptured({ url: (data as { url: string }).url, ...geo });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Photo failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const shown = localPreview ?? preview;
  return (
    <div>
      <button
        type="button"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-400 bg-white px-4 font-semibold text-slate-700 active:bg-slate-100 disabled:opacity-60"
      >
        {busy ? <Spinner /> : <span className="text-xl">📷</span>}
        <Bi en={shown ? `Retake: ${label}` : label} hi={hi} />
      </button>
      <input ref={inputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => e.target.files?.[0] && handle(e.target.files[0])} />
      {shown && <img src={shown} alt="" className="mt-2 max-h-48 w-full rounded-xl object-cover" />}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}

async function compress(file: File): Promise<Blob> {
  const img = await createImageBitmap(file).catch(() => null);
  if (!img) return file; // let the server validate
  const scale = Math.min(1, 1280 / img.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (const q of [0.7, 0.55, 0.4, 0.3]) {
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", q));
    if (blob && blob.size <= 220 * 1024) return blob;
    if (q === 0.3 && blob) return blob;
  }
  return file;
}
