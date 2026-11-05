// src/app/api/materials/[id]/stock/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { NOT_ELEVATOR } from "@/lib/elevator-catalog";
import { changeStock } from "@/lib/materials";
import { restockSchema } from "@/lib/validations/material";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/materials/:id/stock - UC11 เติมสต็อกอุปกรณ์
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ACCOUNTANT", "ADMIN")) {
    return forbiddenResponse("เฉพาะพนักงานบัญชีหรือผู้ดูแลระบบ");
  }

  const { id } = await params;
  const material = await prisma.material.findFirst({ where: { id, ...NOT_ELEVATOR } });
  if (!material) return notFoundResponse("ไม่พบวัสดุ");

  const body = await req.json().catch(() => null);
  const parsed = restockSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { addQuantity, note } = parsed.data;

  try {
    const { material: updated } = await prisma.$transaction((tx) =>
      changeStock(tx, { materialId: id, change: addQuantity, reason: "RESTOCK", employeeId: auth.sub, note })
    );
    return successResponse(updated, "อัปเดตสต็อกสำเร็จ");
  } catch (error) {
    console.error("[RESTOCK_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการเติมสต็อก", 500);
  }
}
