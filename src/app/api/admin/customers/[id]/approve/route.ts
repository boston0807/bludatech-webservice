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
import { sendCustomerApprovalEmail } from "@/lib/email";

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
  const body = await req.json().catch(() => ({}));
  const action = body?.action as "APPROVE" | "REJECT";
  const rejectNote = typeof body?.rejectNote === "string" ? body.rejectNote.trim().slice(0, 1000) : "";

  if (!["APPROVE", "REJECT"].includes(action)) {
    return errorResponse("action ต้องเป็น APPROVE หรือ REJECT", 422);
  }
  // ไม่อนุมัติต้องบอกเหตุผล เพื่อให้ลูกค้าแก้ไขข้อมูลแล้วส่งใหม่ได้ (BP ข้อ 5 → 4)
  if (action === "REJECT" && !rejectNote) {
    return errorResponse("กรุณาระบุเหตุผลที่ไม่อนุมัติ เพื่อให้ลูกค้าแก้ไขข้อมูล", 422);
  }

  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) return notFoundResponse("ไม่พบข้อมูลลูกค้า");

  if (customer.status !== "PENDING") {
    return errorResponse("ลูกค้ารายนี้ไม่อยู่ในสถานะรออนุมัติ", 400);
  }

  const newStatus = action === "APPROVE" ? "ACTIVE" : "REJECTED";

  const changed = await prisma.customer.updateMany({
    where: { id, status: "PENDING" },
    data: { status: newStatus, rejectNote: action === "REJECT" ? rejectNote : null },
  });
  if (changed.count === 0) {
    return errorResponse("ลูกค้ารายนี้ไม่อยู่ในสถานะรออนุมัติ", 400);
  }
  const updated = await prisma.customer.findUniqueOrThrow({
    where: { id },
    select: { id: true, username: true, customerName: true, customerEmail: true, status: true, rejectNote: true },
  });

  const message =
    action === "APPROVE"
      ? `อนุมัติลูกค้า ${updated.customerName} สำเร็จ`
      : `ปฏิเสธลูกค้า ${updated.customerName} แล้ว`;

  // ส่งอีเมลแจ้งลูกค้า (fire-and-forget — ไม่รอผล ไม่พัง API)
  if (updated.customerEmail) {
    sendCustomerApprovalEmail({
      to: updated.customerEmail,
      customerName: updated.customerName,
      action,
      rejectNote: updated.rejectNote,
    });
  }

  return successResponse({ customer: updated, message });
}
