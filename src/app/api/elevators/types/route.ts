// src/app/api/elevators/types/route.ts
// ประเภทลิฟต์ — เก็บในตาราง materials (ดู src/lib/elevator-catalog.ts)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { elevatorTypeSchema } from "@/lib/validations/elevator";
import { encodeType, listModels, listTypes, typeNameTaken } from "@/lib/elevator-catalog";

// GET /api/elevators/types — ทุกคนที่ login ใช้ได้ (ฟอร์มยื่นคำขอบริการใช้เป็นตัวเลือก)
export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const [types, models] = await Promise.all([listTypes(prisma), listModels(prisma)]);
  return successResponse(
    types.map((t) => ({ ...t, _count: { models: models.filter((m) => m.typeId === t.id).length } }))
  );
}

// POST /api/elevators/types — เพิ่มประเภทลิฟต์ (ธุรการ)
export async function POST(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN")) return forbiddenResponse("เฉพาะธุรการที่จัดการข้อมูลลิฟต์ได้");

  const parsed = elevatorTypeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);

  try {
    if (typeNameTaken(await listTypes(prisma), parsed.data.name)) {
      return errorResponse("มีประเภทลิฟต์ชื่อนี้อยู่แล้ว", 409);
    }
    const row = await prisma.material.create({
      data: { materialName: encodeType(parsed.data), price: 0, stockQuantity: 0 },
    });
    return successResponse({ id: row.id, ...parsed.data }, "เพิ่มประเภทลิฟต์สำเร็จ");
  } catch (error) {
    console.error("[CREATE_ELEVATOR_TYPE_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึก", 500);
  }
}
