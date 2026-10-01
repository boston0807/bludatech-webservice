// src/app/api/admin/customers/[id]/approve/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  forbiddenResponse,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-response";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "ADMIN") return forbiddenResponse();

  const { id } = await params;
  const body = await req.json();
  const action = body.action as "APPROVE" | "REJECT";

  if (!["APPROVE", "REJECT"].includes(action)) {
    return errorResponse("action ต้องเป็น APPROVE หรือ REJECT", 422);
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return notFoundResponse("ไม่พบข้อมูลลูกค้า");

  if (customer.status !== "PENDING") {
    return errorResponse("ลูกค้ารายนี้ไม่อยู่ในสถานะรออนุมัติ", 400);
  }

  const newStatus = action === "APPROVE" ? "ACTIVE" : "REJECTED";

  const updated = await prisma.customer.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, username: true, customerName: true, customerEmail: true, status: true },
  });

  const message =
    action === "APPROVE"
      ? `อนุมัติลูกค้า ${updated.customerName} สำเร็จ`
      : `ปฏิเสธลูกค้า ${updated.customerName} แล้ว`;

  return successResponse({ customer: updated, message });
}
