// src/app/api/elevators/models/[id]/route.ts
// รุ่นลิฟต์ — เก็บในตาราง materials (ดู src/lib/elevator-catalog.ts)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { elevatorModelSchema } from "@/lib/validations/elevator";
import { IS_ELEVATOR_MODEL, encodeModel, listModels, listTypes, modelTaken } from "@/lib/elevator-catalog";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/elevators/models/:id — แก้ไขรุ่นลิฟต์ (ธุรการ)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN")) return forbiddenResponse("เฉพาะธุรการที่จัดการข้อมูลลิฟต์ได้");

  const { id } = await params;
  const parsed = elevatorModelSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  const data = parsed.data;

  try {
    const [types, models] = await Promise.all([listTypes(prisma), listModels(prisma)]);
    if (!models.some((m) => m.id === id)) return notFoundResponse("ไม่พบรุ่นลิฟต์");
    const type = types.find((t) => t.id === data.typeId);
    if (!type) return errorResponse("ไม่พบประเภทลิฟต์ที่เลือก", 422);
    if (modelTaken(models, data.brand, data.name, id)) return errorResponse("มีรุ่นนี้ของยี่ห้อนี้อยู่แล้ว", 409);

    await prisma.material.updateMany({
      where: { id, ...IS_ELEVATOR_MODEL },
      data: { materialName: encodeModel(data) },
    });
    return successResponse({ id, ...data, type: { id: type.id, name: type.name } }, "แก้ไขรุ่นลิฟต์สำเร็จ");
  } catch (error) {
    console.error("[UPDATE_ELEVATOR_MODEL_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึก", 500);
  }
}

// DELETE /api/elevators/models/:id — ใบงานเก่าเก็บชื่อรุ่นเป็นข้อความไว้แล้ว จึงลบได้โดยไม่กระทบ
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN")) return forbiddenResponse("เฉพาะธุรการที่จัดการข้อมูลลิฟต์ได้");

  const { id } = await params;
  try {
    const deleted = await prisma.material.deleteMany({ where: { id, ...IS_ELEVATOR_MODEL } });
    if (deleted.count === 0) return notFoundResponse("ไม่พบรุ่นลิฟต์");
    return successResponse(null, "ลบรุ่นลิฟต์สำเร็จ");
  } catch (error) {
    console.error("[DELETE_ELEVATOR_MODEL_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการลบ", 500);
  }
}
