// src/app/api/elevators/models/route.ts
// รุ่นลิฟต์ — เก็บในตาราง materials (ดู src/lib/elevator-catalog.ts)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { elevatorModelSchema } from "@/lib/validations/elevator";
import { encodeModel, listModels, listTypes, modelTaken } from "@/lib/elevator-catalog";

// GET /api/elevators/models — ทุกคนที่ login ใช้ได้ (ฟอร์มยื่นคำขอบริการใช้เป็นตัวเลือก)
export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const [types, models] = await Promise.all([listTypes(prisma), listModels(prisma)]);
  const typeById = new Map(types.map((t) => [t.id, t]));
  return successResponse(
    models.map((m) => {
      const type = typeById.get(m.typeId);
      return { ...m, type: { id: m.typeId, name: type?.name ?? "-" } };
    })
  );
}

// POST /api/elevators/models — เพิ่มรุ่นลิฟต์ (ธุรการ)
export async function POST(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN")) return forbiddenResponse("เฉพาะธุรการที่จัดการข้อมูลลิฟต์ได้");

  const parsed = elevatorModelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  try {
    const [types, models] = await Promise.all([listTypes(prisma), listModels(prisma)]);
    const type = types.find((t) => t.id === data.typeId);
    if (!type) return errorResponse("ไม่พบประเภทลิฟต์ที่เลือก", 422);
    if (modelTaken(models, data.brand, data.name)) return errorResponse("มีรุ่นนี้ของยี่ห้อนี้อยู่แล้ว", 409);

    const row = await prisma.material.create({
      data: { materialName: encodeModel(data), price: 0, stockQuantity: 0 },
    });
    return successResponse({ id: row.id, ...data, type: { id: type.id, name: type.name } }, "เพิ่มรุ่นลิฟต์สำเร็จ");
  } catch (error) {
    console.error("[CREATE_ELEVATOR_MODEL_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึก", 500);
  }
}
