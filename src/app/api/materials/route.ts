// src/app/api/materials/route.ts
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";

// price เป็น Decimal(10,2) → สูงสุด 99,999,999.99
const createMaterialSchema = z.object({
  materialName: z.string().trim().min(1, "กรุณากรอกชื่อวัสดุ").max(255, "ชื่อวัสดุยาวเกินไป"),
  price: z.coerce
    .number({ invalid_type_error: "กรุณากรอกราคาเป็นตัวเลข" })
    .min(0, "ราคาต้องไม่ติดลบ")
    .max(99_999_999.99, "ราคาสูงเกินไป"),
  stockQuantity: z.coerce
    .number({ invalid_type_error: "กรุณากรอกจำนวนเป็นตัวเลข" })
    .int("จำนวนต้องเป็นจำนวนเต็ม")
    .min(0, "จำนวนต้องไม่ติดลบ")
    .max(1_000_000, "จำนวนมากเกินไป")
    .default(0),
});

// GET /api/materials - รายการวัสดุทั้งหมด
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const materials = await prisma.material.findMany({
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

  const body = await req.json().catch(() => ({}));
  // หน้าเว็บส่ง NaN เมื่อช่องว่าง → JSON เป็น null; ถือว่าไม่ได้กรอก
  const parsed = createMaterialSchema.safeParse({
    ...body,
    price: body?.price ?? undefined,
    stockQuantity: body?.stockQuantity ?? undefined,
  });
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }

  try {
    const material = await prisma.material.create({
      data: {
        materialName: parsed.data.materialName,
        price: Math.round(parsed.data.price * 100) / 100,
        stockQuantity: parsed.data.stockQuantity,
      },
    });
    return successResponse(material, "เพิ่มวัสดุสำเร็จ");
  } catch (error) {
    console.error("[CREATE_MATERIAL_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการเพิ่มวัสดุ", 500);
  }
}
