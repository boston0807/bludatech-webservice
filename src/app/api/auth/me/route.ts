// src/app/api/auth/me/route.ts — ข้อมูลผู้ใช้ที่ login อยู่ (ใช้ในหน้าเว็บเพื่อรู้ว่าตัวเองเป็นใคร)
import { NextRequest } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { successResponse, unauthorizedResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  return successResponse({ sub: auth.sub, username: auth.username, role: auth.role, name: auth.name });
}
