/** Thumbnail linking to the full photo, with an OpenStreetMap link when geotagged. */
export function PhotoLink({ url, lat, lng, size = "h-16 w-16" }: { url: string | null; lat?: number | null; lng?: number | null; size?: string }) {
  if (!url) return null;
  return (
    <span className="inline-flex items-center gap-2">
      <a href={url} target="_blank" rel="noreferrer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="photo" className={`${size} rounded-lg object-cover`} />
      </a>
      {lat != null && lng != null && (
        <a className="text-xs font-semibold text-brand underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`}>
          📍 Map
        </a>
      )}
    </span>
  );
}
