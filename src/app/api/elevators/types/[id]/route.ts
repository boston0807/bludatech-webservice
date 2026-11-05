// src/app/api/elevators/types/[id]/route.ts
// ประเภทลิฟต์ — เก็บในตาราง materials (ดู src/lib/elevator-catalog.ts)
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
import { elevatorTypeSchema } from "@/lib/validations/elevator";
import { IS_ELEVATOR_TYPE, encodeType, listModels, listTypes, typeNameTaken } from "@/lib/elevator-catalog";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/elevators/types/:id — แก้ไขประเภทลิฟต์ (ธุรการ)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN")) return forbiddenResponse("เฉพาะธุรการที่จัดการข้อมูลลิฟต์ได้");

  const { id } = await params;
  const parsed = elevatorTypeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);

  try {
    const types = await listTypes(prisma);
    if (!types.some((t) => t.id === id)) return notFoundResponse("ไม่พบประเภทลิฟต์");
    if (typeNameTaken(types, parsed.data.name, id)) return errorResponse("มีประเภทลิฟต์ชื่อนี้อยู่แล้ว", 409);

    await prisma.material.updateMany({
      where: { id, ...IS_ELEVATOR_TYPE },
      data: { materialName: encodeType(parsed.data) },
    });
    return successResponse({ id, ...parsed.data }, "แก้ไขประเภทลิฟต์สำเร็จ");
  } catch (error) {
    console.error("[UPDATE_ELEVATOR_TYPE_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึก", 500);
  }
}

// DELETE /api/elevators/types/:id — ลบได้เมื่อไม่มีรุ่นลิฟต์ใช้ประเภทนี้อยู่
export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN")) return forbiddenResponse("เฉพาะธุรการที่จัดการข้อมูลลิฟต์ได้");

  const { id } = await params;
  try {
    const modelCount = (await listModels(prisma)).filter((m) => m.typeId === id).length;
    if (modelCount > 0) {
      return errorResponse(
        `ลบไม่ได้ เพราะมีรุ่นลิฟต์ ${modelCount} รุ่นใช้ประเภทนี้อยู่ กรุณาย้ายหรือลบรุ่นเหล่านั้นก่อน`,
        409
      );
    }
    const deleted = await prisma.material.deleteMany({ where: { id, ...IS_ELEVATOR_TYPE } });
    if (deleted.count === 0) return notFoundResponse("ไม่พบประเภทลิฟต์");
    return successResponse(null, "ลบประเภทลิฟต์สำเร็จ");
  } catch (error) {
    console.error("[DELETE_ELEVATOR_TYPE_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการลบ", 500);
  }
}
