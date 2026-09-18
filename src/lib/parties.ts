/**
 * The key that decides whether two typed names are the same payee.
 *
 * Names are typed by hand on a phone, so "Kamla Hardware", "kamla hardware" and
 * "  Kamla  Hardware " must land on one ledger rather than three. Only case and
 * spacing are normalised — a genuinely different spelling stays a different
 * payee, which the office can merge deliberately.
 */
export function normalizePartyName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
