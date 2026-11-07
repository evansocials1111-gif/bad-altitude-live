import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { config } from "./config";
import { q, q1 } from "./db";
import { ApiError } from "./errors";

const COOKIE = "ba_session";
const secret = () => {
  if (!config.sessionSecret) throw new ApiError(500, "misconfigured", "SESSION_SECRET is not set");
  return new TextEncoder().encode(config.sessionSecret);
};

export type SessionUser = {
  id: string; username: string; role: "user" | "moderator" | "admin";
  status: "active" | "muted" | "banned"; avatar_seed: string; bio: string;
  hide_wallet: boolean; hide_from_leaderboard: boolean; created_at: string;
};

export async function issueSessionToken(userId: string) {
  return new SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject(userId).setIssuedAt().setExpirationTime("30d").sign(secret());
}

export async function startSession(userId: string) {
  (await cookies()).set(COOKIE, await issueSessionToken(userId), {
    httpOnly: true, sameSite: "lax", secure: config.isProd, path: "/", maxAge: 60 * 60 * 24 * 30,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    if (!payload.sub) return null;
    // Role and status always come from the database, never from the token.
    const user = await q1<SessionUser>(`select * from users where id = $1`, [payload.sub]);
    if (!user || user.status === "banned") return null;
    await q(`update users set last_seen_at = now() where id = $1 and last_seen_at < now() - interval '1 minute'`, [user.id]);
    return user;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "unauthenticated", "Enter the community first.");
  return user;
}

export async function requireRole(...roles: SessionUser["role"][]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new ApiError(403, "forbidden", "Not allowed.");
  return user;
}
