// Email + password auth with PBKDF2 (WebCrypto) and opaque session tokens stored hashed in D1.
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import type { AppEnv, SessionUser } from "./env";
import { now, sha256Hex } from "./util";

// workerd caps PBKDF2 at 100k. The count is stored with each hash ("<iterations>$<hash>") so it can be
// tuned to the Workers CPU limit via PBKDF2_ITERATIONS without breaking existing accounts.
export const DEFAULT_ITERATIONS = 100_000;
const SESSION_DAYS = 14;
export const COOKIE = "raasta_session";

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function hashPassword(password: string, saltB64?: string, iterations = DEFAULT_ITERATIONS) {
  const salt = saltB64 ? unb64(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return { hash: `${iterations}$${b64(new Uint8Array(bits))}`, salt: b64(salt) };
}

export async function verifyPassword(password: string, stored: string, salt: string): Promise<boolean> {
  const [iter, digest] = stored.includes("$") ? stored.split("$") : [String(DEFAULT_ITERATIONS), stored];
  const h = (await hashPassword(password, salt, Number(iter))).hash.split("$")[1];
  if (h.length !== digest.length) return false;
  let diff = 0;
  for (let i = 0; i < h.length; i++) diff |= h.charCodeAt(i) ^ digest.charCodeAt(i);
  return diff === 0;
}

export async function createSession(c: Context<AppEnv>, userId: string) {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const token = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString();
  await c.env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .bind(await sha256Hex(token), userId, expires, now())
    .run();
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(c: Context<AppEnv>) {
  const token = getCookie(c, COOKIE);
  if (token) await c.env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await sha256Hex(token)).run();
  deleteCookie(c, COOKIE, { path: "/" });
}

export const loadUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("user", null);
  const token = getCookie(c, COOKIE);
  if (token && /^[0-9a-f]{64}$/.test(token)) {
    const row = await c.env.DB.prepare(
      `SELECT u.id, u.email, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
      .bind(await sha256Hex(token), now())
      .first<SessionUser>();
    if (row) c.set("user", row);
  }
  await next();
};

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.get("user")) return c.json({ error: "Please sign in." }, 401);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const u = c.get("user");
  if (!u) return c.json({ error: "Please sign in." }, 401);
  if (u.role !== "admin") return c.json({ error: "Admin only." }, 403);
  await next();
};
