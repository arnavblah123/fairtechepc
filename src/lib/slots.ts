/** The five mandatory daily photo windows, in IST hours. */
export const PHOTO_SLOTS = [
  { slot: 1, label: "8–10 AM", from: 8, to: 10 },
  { slot: 2, label: "10–12", from: 10, to: 12 },
  { slot: 3, label: "12–2 PM", from: 12, to: 14 },
  { slot: 4, label: "2–4 PM", from: 14, to: 16 },
  { slot: 5, label: "4–6 PM", from: 16, to: 18 },
] as const;

export function slotForHour(h: number): number | null {
  const s = PHOTO_SLOTS.find((s) => h >= s.from && h < s.to);
  return s?.slot ?? null;
}
