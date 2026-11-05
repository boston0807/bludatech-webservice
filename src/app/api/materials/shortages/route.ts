// src/app/api/materials/shortages/route.ts
// UC10/UC11 — วัสดุที่ถูกจองในแผนงานมากกว่าของในคลัง (ต้องสั่งซื้อเพิ่มก่อนเริ่มงาน)
// ฝ่ายบัญชีเห็นอัตโนมัติว่าต้องซื้ออะไร กี่ชิ้น เพื่องานไหน โดยช่างไม่ต้องแจ้งนอกระบบ (ปัญหาข้อ 3)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import { successResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { getMaterialUsage, getLowStockThreshold } from "@/lib/materials";

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN", "ACCOUNTANT", "TECHNICIAN", "HEAD_TECHNICIAN")) return forbiddenResponse();

  const usage = await getMaterialUsage(prisma);
  const threshold = getLowStockThreshold();
  const shortages = usage
    .filter((m) => m.shortageQty > 0)
    .map((m) => ({
      ...m,
      // งานที่จะเริ่มไม่ได้ถ้ายังไม่สั่งซื้อ (เรียงตามวันเริ่มงาน)
      earliestStartDate: m.reservedBy[0]?.startDate ?? null,
    }))
    .sort((a, b) => (a.earliestStartDate?.getTime() ?? 0) - (b.earliestStartDate?.getTime() ?? 0));

  const lowStock = usage
    .filter((m) => m.shortageQty === 0 && m.stockQuantity - m.reservedQty <= threshold)
    .map(({ reservedBy: _reservedBy, ...m }) => ({ ...m, availableQty: m.stockQuantity - m.reservedQty }));

  return successResponse({
    shortages,
    lowStock,
    usage: usage.map(({ reservedBy: _reservedBy, ...m }) => ({ ...m, availableQty: m.stockQuantity - m.reservedQty })),
    threshold,
  });
}
