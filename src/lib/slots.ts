/** The three mandatory daily photo windows, in IST hours. */
export const PHOTO_SLOTS = [
  { slot: 1, label: "Morning 8–11", hi: "सुबह", from: 8, to: 11 },
  { slot: 2, label: "Midday 11–2", hi: "दोपहर", from: 11, to: 14 },
  { slot: 3, label: "Evening 2–6", hi: "शाम", from: 14, to: 18 },
] as const;

export function slotForHour(h: number): number | null {
  const s = PHOTO_SLOTS.find((s) => h >= s.from && h < s.to);
  return s?.slot ?? null;
}

/** Label for a stored slot number; photos from the old five-window scheme fall back to "Extra". */
export function slotLabel(slot: number | null | undefined): string {
  return PHOTO_SLOTS.find((s) => s.slot === slot)?.label ?? "Extra";
}
