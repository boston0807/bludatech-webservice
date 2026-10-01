// src/app/api/materials/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";

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

  const body = await req.json();
  const { materialName, price, stockQuantity } = body;

  if (!materialName || price === undefined) {
    return errorResponse("กรุณากรอกชื่อวัสดุและราคา", 422);
  }

  try {
    const material = await prisma.material.create({
      data: {
        materialName,
        price: parseFloat(price),
        stockQuantity: parseInt(stockQuantity || 0),
      },
    });
    return successResponse(material, "เพิ่มวัสดุสำเร็จ");
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาด", 500);
  }
}
