import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { AuthError, requireUser, type SessionUser } from "./auth";
import { can, type Capability } from "./permissions";
import { Prisma } from "@prisma/client";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Handler<T> = (ctx: { user: SessionUser; req: Request; params: T; ip: string | null }) => Promise<Response>;

/**
 * Wrap an App Router handler: enforces login + capability server-side and turns
 * thrown errors into JSON. Every mutation route MUST use this with a capability.
 */
export function withAuth<T = Record<string, string>>(cap: Capability | null, handler: Handler<T>) {
  return async (req: Request, ctx: { params: Promise<T> }): Promise<Response> => {
    try {
      const user = await requireUser();
      if (cap && !can(user.role, cap)) throw new AuthError(403, "Not allowed for your role");
      const params = ctx?.params ? await ctx.params : ({} as T);
      const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
      return await handler({ user, req, params, ip });
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown): Response {
  if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: err.status });
  if (err instanceof ApiError) return NextResponse.json({ error: err.message, details: err.details }, { status: err.status });
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const msg = first ? `${first.path.join(".") || "input"}: ${first.message}` : "Invalid input";
    return NextResponse.json({ error: msg, details: err.issues }, { status: 400 });
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") return NextResponse.json({ error: "Already exists (duplicate value)" }, { status: 409 });
    if (err.code === "P2025") return NextResponse.json({ error: "Record not found" }, { status: 404 });
  }
  console.error(err);
  return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
}

export async function parseBody<S extends ZodSchema>(req: Request, schema: S): Promise<S["_output"]> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Body must be JSON");
  }
  return schema.parse(json);
}

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

/** CSV helper for export endpoints. */
export function csvResponse(filename: string, rows: Record<string, unknown>[]): Response {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\r\n");
  return new Response("﻿" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
