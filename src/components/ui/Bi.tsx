/** Bilingual label: English primary, Hindi in smaller text underneath. */
export function Bi({ en, hi, className = "", inline = false }: { en: string; hi?: string; className?: string; inline?: boolean }) {
  if (inline) {
    return (
      <span className={className}>
        {en}
        {hi && <span className="ml-1 text-[0.8em] opacity-70">/ {hi}</span>}
      </span>
    );
  }
  return (
    <span className={`flex flex-col leading-tight ${className}`}>
      <span>{en}</span>
      {hi && <span className="text-[0.72em] font-normal opacity-75">{hi}</span>}
    </span>
  );
}
