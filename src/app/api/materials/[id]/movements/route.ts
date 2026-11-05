// src/app/api/materials/[id]/movements/route.ts
// ประวัติการเคลื่อนไหวของสต็อกวัสดุ (รับเข้า / เบิกใช้ / ปรับยอด) — ใช้ตรวจหายอดที่ไม่ตรง
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { NOT_ELEVATOR } from "@/lib/elevator-catalog";

type Params = { params: Promise<{ id: string }> };

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// GET /api/materials/:id/movements?limit=50&cursor=<movementId>
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ACCOUNTANT", "ADMIN", "HEAD_TECHNICIAN")) return forbiddenResponse();

  const { id } = await params;
  const material = await prisma.material.findFirst({ where: { id, ...NOT_ELEVATOR } });
  if (!material) return notFoundResponse("ไม่พบวัสดุ");

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(sp.get("limit")) || DEFAULT_LIMIT, 1), MAX_LIMIT);
  const cursor = sp.get("cursor");

  const rows = await prisma.stockMovement.findMany({
    where: { materialId: id },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      employee: { select: { employeeName: true } },
      job: { select: { id: true, jobAddress: true, customer: { select: { customerName: true } } } },
    },
  });

  const hasMore = rows.length > limit;
  const movements = hasMore ? rows.slice(0, limit) : rows;

  // ผลรวม change ทั้งหมดควรเท่ากับยอดคงเหลือ — ถ้าไม่เท่าแปลว่ามีการแก้ยอดนอกระบบ
  const sum = await prisma.stockMovement.aggregate({ where: { materialId: id }, _sum: { change: true } });
  const loggedBalance = sum._sum.change ?? 0;

  return successResponse({
    material: { id: material.id, materialName: material.materialName, stockQuantity: material.stockQuantity },
    movements,
    nextCursor: hasMore ? movements[movements.length - 1].id : null,
    reconciliation: {
      loggedBalance,
      actualBalance: material.stockQuantity,
      matches: loggedBalance === material.stockQuantity,
    },
  });
}
