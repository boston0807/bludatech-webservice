// src/app/api/materials/[id]/stock/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/materials/:id/stock - UC11 เติมสต็อกอุปกรณ์
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  if (payload.role !== "ACCOUNTANT" && payload.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะพนักงานบัญชีหรือผู้ดูแลระบบ");
  }

  const { id } = await params;
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return notFoundResponse("ไม่พบวัสดุ");

  const body = await req.json();
  const { addQuantity } = body;

  if (addQuantity === undefined || typeof addQuantity !== "number") {
    return errorResponse("กรุณาระบุจำนวนที่ต้องการเพิ่ม (addQuantity)", 422);
  }

  const updated = await prisma.material.update({
    where: { id },
    data: {
      stockQuantity: { increment: addQuantity },
    },
  });

  return successResponse(updated, "อัปเดตสต็อกสำเร็จ");
}
