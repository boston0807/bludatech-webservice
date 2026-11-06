// src/app/api/materials/[id]/stock/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

const MAX_RESTOCK = 100_000;

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

  const body = await req.json().catch(() => ({}));
  const addQuantity = body?.addQuantity;

  // เติมสต็อกได้เฉพาะจำนวนเต็มบวก (เดิมรับค่าติดลบ/ทศนิยมได้ → สต็อกติดลบ หรือ Prisma error 500)
  if (typeof addQuantity !== "number" || !Number.isInteger(addQuantity) || addQuantity < 1 || addQuantity > MAX_RESTOCK) {
    return errorResponse(`จำนวนที่เติมต้องเป็นจำนวนเต็มตั้งแต่ 1 ถึง ${MAX_RESTOCK.toLocaleString()}`, 422);
  }

  const updated = await prisma.material.update({
    where: { id },
    data: {
      stockQuantity: { increment: addQuantity },
    },
  });

  return successResponse(updated, "อัปเดตสต็อกสำเร็จ");
}
