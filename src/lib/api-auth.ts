// src/lib/api-auth.ts
// helper ตรวจ token + role สำหรับ API route (ใช้แทนการเขียน verifyToken ซ้ำทุกไฟล์)

import type { NextRequest } from "next/server";
import { verifyToken, AUTH_COOKIE_NAME, type JWTPayload } from "@/lib/auth";

export type Role = JWTPayload["role"];

export const TECHNICIAN_ROLES: Role[] = ["TECHNICIAN", "HEAD_TECHNICIAN"];
export const STAFF_ROLES: Role[] = ["ADMIN", "ACCOUNTANT", "TECHNICIAN", "HEAD_TECHNICIAN"];

export async function getAuth(req: NextRequest): Promise<JWTPayload | null> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export function hasRole(auth: JWTPayload | null, ...roles: Role[]): auth is JWTPayload {
  return !!auth && roles.includes(auth.role);
}
