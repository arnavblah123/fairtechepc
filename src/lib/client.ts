"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Fetch wrapper for our JSON API: throws ClientApiError with the server's message. */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: init.body ? { "Content-Type": "application/json" } : undefined,
      body: init.body ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
    });
  } catch {
    throw new ClientApiError(0, "No internet. Please check your connection and try again. / इंटरनेट नहीं है");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.href = "/login";
    throw new ClientApiError(res.status, (data as { error?: string }).error ?? `Request failed (${res.status})`, (data as { details?: unknown }).details);
  }
  return data as T;
}

/**
 * Common submit pattern: shows a "Saved" toast on success, error toast on failure,
 * optionally navigates and refreshes server components.
 */
export function useSubmit() {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  async function submit<T>(fn: () => Promise<T>, opts: { to?: string; refresh?: boolean; silent?: boolean } = {}): Promise<T | undefined> {
    setBusy(true);
    try {
      const result = await fn();
      if (!opts.silent) toast.saved();
      if (opts.to) router.push(opts.to);
      if (opts.refresh !== false) router.refresh();
      return result;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      return undefined;
    } finally {
      setBusy(false);
    }
  }

  return { busy, submit };
}
