// src/lib/auth.ts
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

export type JWTPayload = {
  sub: string;
  username: string;
  role: "CUSTOMER" | "ADMIN" | "TECHNICIAN" | "HEAD_TECHNICIAN" | "ACCOUNTANT";
  name: string;
};

// ใช้เฉพาะตอนพัฒนาในเครื่องเท่านั้น — production ต้องตั้ง JWT_SECRET (wrangler secret put JWT_SECRET)
const DEV_FALLBACK_SECRET = "dev-only-insecure-jwt-secret";
const MIN_SECRET_LENGTH = 32;

let cachedSecret: Uint8Array | null = null;
let warnedDevFallback = false;

/**
 * อ่าน secret ตอนใช้งาน (ไม่อ่านตอน import) เพราะบน Cloudflare Workers env ถูกใส่ตอนรับ request
 * และไม่ให้ build/deploy พังเพราะยังไม่ได้ตั้ง env — แต่ production จะไม่ยอมออก/ตรวจ token ด้วย secret ที่เดาได้
 */
function getSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;

  const secret = process.env.JWT_SECRET;
  if (secret && secret.length >= MIN_SECRET_LENGTH) {
    cachedSecret = new TextEncoder().encode(secret);
    return cachedSecret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `JWT_SECRET ไม่ได้ตั้งค่าหรือสั้นกว่า ${MIN_SECRET_LENGTH} ตัวอักษร — ตั้งด้วย "npx wrangler secret put JWT_SECRET"`
    );
  }

  if (!warnedDevFallback) {
    console.warn("[auth] JWT_SECRET ไม่ได้ตั้งค่าหรือสั้นเกินไป ใช้ secret สำหรับ dev แทน (ห้ามใช้บน production)");
    warnedDevFallback = true;
  }
  return new TextEncoder().encode(secret || DEV_FALLBACK_SECRET);
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? "7d")
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  let secret: Uint8Array;
  try {
    secret = getSecret();
  } catch (error) {
    // ตั้งค่าระบบผิด — log ให้เห็นชัด และถือว่า token ใช้ไม่ได้ (ไม่ยอมรับ token ที่อาจถูกปลอม)
    console.error("[auth]", (error as Error).message);
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("auth_token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export const AUTH_COOKIE_NAME = "auth_token";

export function getAuthCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  };
}
