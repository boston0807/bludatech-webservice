// src/app/api/notifications/route.ts
// GET   — การแจ้งเตือนล่าสุดของผู้ใช้ + จำนวนที่ยังไม่อ่าน
// PATCH — ทำเครื่องหมายว่าอ่านแล้ว { ids: string[] } หรือ { all: true }
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import type { JWTPayload } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";

const LIMIT = 30;

function ownerWhere(auth: JWTPayload) {
  return auth.role === "CUSTOMER" ? { customerId: auth.sub } : { employeeId: auth.sub };
}

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const where = ownerWhere(auth);
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: LIMIT,
      select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
    }),
    prisma.notification.count({ where: { ...where, readAt: null } }),
  ]);
  return successResponse({ items, unreadCount });
}

const markSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ ids: z.array(z.string().min(1)).min(1).max(100) }),
]);

export async function PATCH(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const parsed = markSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("ข้อมูลไม่ถูกต้อง", 422);

  const result = await prisma.notification.updateMany({
    where: { ...ownerWhere(auth), readAt: null, ...("ids" in parsed.data ? { id: { in: parsed.data.ids } } : {}) },
    data: { readAt: new Date() },
  });
  return successResponse({ updated: result.count });
}
