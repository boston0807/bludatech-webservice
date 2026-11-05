// src/app/api/materials/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { NOT_ELEVATOR, isReservedMaterialName } from "@/lib/elevator-catalog";
import { changeStock } from "@/lib/materials";
import { createMaterialSchema } from "@/lib/validations/material";

// GET /api/materials - รายการวัสดุทั้งหมด
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const materials = await prisma.material.findMany({
    where: NOT_ELEVATOR, // แถวข้อมูลลิฟต์ไม่ใช่สินค้าในคลัง
    orderBy: { materialName: "asc" },
  });
  return successResponse(materials);
}

// POST /api/materials - เพิ่มวัสดุใหม่ (หรือสั่งซื้อเข้าคลัง)
export async function POST(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  if (payload.role !== "ACCOUNTANT" && payload.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะพนักงานบัญชีหรือผู้ดูแลระบบที่สามารถเพิ่ม/สั่งซื้อวัสดุได้");
  }

  const body = await req.json().catch(() => null);
  const parsed = createMaterialSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { materialName, price, stockQuantity } = parsed.data;
  if (isReservedMaterialName(materialName)) {
    return errorResponse("ชื่อวัสดุต้องไม่ขึ้นต้นด้วย @elevator-", 422);
  }

  try {
    // สร้างด้วยยอด 0 แล้วรับยอดตั้งต้นผ่าน changeStock เพื่อให้มีแถวประวัติ INITIAL
    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.material.create({ data: { materialName, price, stockQuantity: 0 } });
      if (stockQuantity === 0) return created;
      const { material } = await changeStock(tx, {
        materialId: created.id,
        change: stockQuantity,
        reason: "INITIAL",
        employeeId: payload.sub,
      });
      return material;
    });
    return successResponse(material, "เพิ่มวัสดุสำเร็จ");
  } catch (error) {
    console.error("[CREATE_MATERIAL_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการเพิ่มวัสดุ", 500);
  }
}
