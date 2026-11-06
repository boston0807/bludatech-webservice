// src/app/api/auth/change-password/route.ts
// เปลี่ยนรหัสผ่านของผู้ใช้ที่ login อยู่ (ลูกค้าและพนักงานทุกบทบาท) — ใช้ field password เดิม
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from "@/lib/api-response";
import { changePasswordSchema } from "@/lib/validations/auth";
import { createRateLimiter } from "@/lib/rate-limit";

// กันเดารหัสผ่านปัจจุบันจาก session ที่ถูกขโมย: ผิดเกิน 5 ครั้งใน 15 นาที → พัก
const limiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });

export async function POST(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const key = `change-password:${auth.role === "CUSTOMER" ? "c" : "e"}:${auth.sub}`;
  const wait = limiter.blockedFor(key);
  if (wait > 0) {
    return errorResponse(`กรอกรหัสผ่านผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${Math.ceil(wait / 60)} นาที`, 429);
  }

  const body = await req.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { currentPassword, newPassword } = parsed.data;

  const account =
    auth.role === "CUSTOMER"
      ? await prisma.customer.findUnique({ where: { id: auth.sub }, select: { password: true } })
      : await prisma.employee.findUnique({ where: { id: auth.sub }, select: { password: true } });
  if (!account) return notFoundResponse("ไม่พบบัญชีผู้ใช้");

  if (!(await bcrypt.compare(currentPassword, account.password))) {
    limiter.hit(key);
    return errorResponse("รหัสผ่านปัจจุบันไม่ถูกต้อง", 422, { currentPassword: ["รหัสผ่านปัจจุบันไม่ถูกต้อง"] });
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  if (auth.role === "CUSTOMER") {
    await prisma.customer.update({ where: { id: auth.sub }, data: { password: hashed } });
  } else {
    await prisma.employee.update({ where: { id: auth.sub }, data: { password: hashed } });
  }
  limiter.reset(key);

  return successResponse(null, "เปลี่ยนรหัสผ่านสำเร็จ");
}
