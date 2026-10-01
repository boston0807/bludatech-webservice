// src/app/api/quotations/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

const quotationActionSchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT", "CANCEL"]),
    rejectNote: z.string().optional(),
  })
  .refine(
    (data) =>
      data.action !== "REJECT" ||
      (data.rejectNote !== undefined && data.rejectNote.trim().length > 0),
    { message: "กรุณาระบุเหตุผลที่ปฏิเสธ", path: ["rejectNote"] }
  );

// PATCH /api/quotations/:id — ลูกค้าดำเนินการกับใบเสนอราคา
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "CUSTOMER") return forbiddenResponse();

  const { id: quotationId } = await params;

  try {
    // ดึง quotation พร้อม job
    const quotation = await prisma.quotation.findUnique({
      where: { id: quotationId },
      include: { job: true },
    });

    if (!quotation) return notFoundResponse("ไม่พบใบเสนอราคา");

    // ตรวจสอบว่า customer เป็นเจ้าของ job นี้
    if (quotation.job.customerId !== payload.sub) {
      return forbiddenResponse("คุณไม่มีสิทธิ์ดำเนินการกับใบเสนอราคานี้");
    }

    // ตรวจสอบสถานะ quotation ต้องเป็น PENDING เท่านั้น
    if (quotation.status !== "PENDING") {
      return errorResponse("ใบเสนอราคานี้ไม่สามารถดำเนินการได้แล้ว", 409);
    }

    const body = await req.json();
    const parsed = quotationActionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    const { action, rejectNote } = parsed.data;

    let updatedQuotation;

    if (action === "APPROVE") {
      // APPROVE: quotation → APPROVED, job → APPROVE
      [updatedQuotation] = await prisma.$transaction([
        prisma.quotation.update({
          where: { id: quotationId },
          data: { status: "APPROVED" },
        }),
        prisma.job.update({
          where: { id: quotation.jobId },
          data: { status: "APPROVE" },
        }),
      ]);
    } else if (action === "REJECT") {
      // REJECT: quotation → REJECTED, job → REQUEST_EDIT, บันทึก rejectNote
      [updatedQuotation] = await prisma.$transaction([
        prisma.quotation.update({
          where: { id: quotationId },
          data: { status: "REJECTED", rejectNote: rejectNote ?? null },
        }),
        prisma.job.update({
          where: { id: quotation.jobId },
          data: { status: "REQUEST_EDIT" },
        }),
      ]);
    } else {
      // CANCEL: job → CANCELLED (quotation ยังคง PENDING)
      [updatedQuotation] = await prisma.$transaction([
        prisma.quotation.update({
          where: { id: quotationId },
          data: { status: "REJECTED", rejectNote: "ลูกค้ายกเลิก" },
        }),
        prisma.job.update({
          where: { id: quotation.jobId },
          data: { status: "CANCELLED" },
        }),
      ]);
    }

    return successResponse(updatedQuotation);
  } catch (error) {
    console.error("[QUOTATION_ACTION_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาด", 500);
  }
}
