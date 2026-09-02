import "server-only";
import { cookies, headers } from "next/headers";
import { cache } from "react";
import { randomBytes, createHmac } from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import { audit } from "./audit";
import type { Role, User } from "@prisma/client";

export const SESSION_COOKIE = "ft_session";
const SESSION_DAYS = 30;

export type SessionUser = Pick<User, "id" | "username" | "name" | "role" | "siteId" | "active"> & {
  site: { id: string; name: string; code: string; city: string } | null;
};

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error("SESSION_SECRET must be set (16+ chars)");
  return s;
}

// The cookie holds a random token; only its HMAC is stored in the DB so a DB leak cannot forge sessions.
function tokenHash(token: string) {
  return createHmac("sha256", secret()).update(token).digest("hex");
}

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  const h = await headers();
  await prisma.session.create({
    data: { token: tokenHash(token), userId, expiresAt, userAgent: h.get("user-agent")?.slice(0, 200) },
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token: tokenHash(token) } }).catch(() => {});
  }
  jar.delete(SESSION_COOKIE);
}

/** Invalidate every session of a user (used on password reset / deactivation). */
export async function revokeUserSessions(userId: string) {
  await prisma.session.deleteMany({ where: { userId } });
}

/** Current logged-in user or null. Cached per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token: tokenHash(token) },
    include: {
      user: {
        select: {
          id: true,
          username: true,
          name: true,
          role: true,
          siteId: true,
          active: true,
          site: { select: { id: true, name: true, code: true, city: true } },
        },
      },
    },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) return null;
  return session.user;
});

export class AuthError extends Error {
  constructor(
    public status: 401 | 403,
    message: string,
  ) {
    super(message);
  }
}

/** For API routes: returns the user or throws AuthError. */
export async function requireUser(roles?: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "Not logged in");
  if (roles && !roles.includes(user.role)) throw new AuthError(403, "Not allowed for your role");
  return user;
}

export async function login(username: string, password: string, ip?: string | null) {
  const user = await prisma.user.findUnique({ where: { username: username.trim().toLowerCase() } });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return null;
  await createSession(user.id);
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ userId: user.id, siteId: user.siteId, action: "LOGIN", entity: "User", entityId: user.id, ip });
  return user;
}
