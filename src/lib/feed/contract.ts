// Admin Feed contract, version 1.
// Local copy of the owner dashboard's `lib/feed/contract.ts` (fairtechadmin). Keep in sync by hand.

export const FEED_VERSION = 1 as const;
export const FEED_KEY_HEADER = "x-admin-key";

export type Tone = "neutral" | "good" | "warn" | "bad";

export type FeedKpi = {
  key: string;
  label: string;
  value: number | string;
  unit?: string;
  tone?: Tone;
  hint?: string;
  href?: string;
};

export type FeedAction = {
  id: string;
  label: string;
  tone?: "primary" | "danger" | "neutral";
  noteRequired?: boolean;
  amountEditable?: boolean;
};

export type FeedApproval = {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  /** Rupees. */
  amount?: number;
  requestedBy?: string;
  /** ISO 8601. */
  requestedAt: string;
  unit?: string;
  href?: string;
  actions: FeedAction[];
};

export type FlagSeverity = "critical" | "warning" | "info";

export type FeedFlag = {
  id: string;
  severity: FlagSeverity;
  kind: string;
  title: string;
  detail?: string;
  since?: string;
  unit?: string;
  href?: string;
  count?: number;
  actions?: FeedAction[];
};

export type FeedActivity = {
  id: string;
  at: string;
  actor?: string;
  text: string;
  href?: string;
};

export type FeedMessage = {
  id: string;
  at: string;
  from?: string;
  channel?: string;
  text: string;
  href?: string;
  unread?: boolean;
};

export type FeedReport = {
  id: string;
  title: string;
  description?: string;
  href: string;
  period?: string;
};

export type AdminFeed = {
  version: typeof FEED_VERSION;
  app: string;
  label: string;
  generatedAt: string;
  units?: string[];
  kpis: FeedKpi[];
  approvals: FeedApproval[];
  flags: FeedFlag[];
  activity: FeedActivity[];
  messages: FeedMessage[];
  reports: FeedReport[];
};

export type FeedActRequest = {
  approvalId?: string;
  flagId?: string;
  actionId: string;
  note?: string;
  amount?: number;
  actor: { name: string; email: string };
};

export type FeedActResponse = {
  ok: boolean;
  message?: string;
  error?: string;
};
