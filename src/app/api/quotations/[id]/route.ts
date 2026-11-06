// src/app/api/quotations/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import {
  ApiError,
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

    const body = await req.json().catch(() => ({}));
    const parsed = quotationActionSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    const { action, rejectNote } = parsed.data;

    // APPROVE: quotation → APPROVED, job → APPROVE
    // REJECT:  quotation → REJECTED, job → REQUEST_EDIT (ให้ช่างสำรวจ/ประเมินใหม่)
    // CANCEL:  quotation → REJECTED, job → CANCELLED
    const next = {
      APPROVE: { quotation: { status: "APPROVED" as const }, job: "APPROVE" as const },
      REJECT: { quotation: { status: "REJECTED" as const, rejectNote: rejectNote?.trim() ?? null }, job: "REQUEST_EDIT" as const },
      CANCEL: { quotation: { status: "REJECTED" as const, rejectNote: "ลูกค้ายกเลิก" }, job: "CANCELLED" as const },
    }[action];

    // อัปเดตแบบมีเงื่อนไขใน transaction เดียว กันกดซ้ำ/กดพร้อมกันหลายแท็บ
    // (เดิมตรวจสถานะก่อนแล้วอัปเดตแบบไม่มีเงื่อนไข → อนุมัติแล้วยังยกเลิกซ้ำได้)
    const updatedQuotation = await prisma.$transaction(async (tx) => {
      const changed = await tx.quotation.updateMany({
        where: { id: quotationId, status: "PENDING" },
        data: next.quotation,
      });
      if (changed.count === 0) throw new ApiError("ใบเสนอราคานี้ไม่สามารถดำเนินการได้แล้ว", 409);

      const moved = await tx.job.updateMany({
        where: { id: quotation.jobId, status: "QUOTED" },
        data: { status: next.job },
      });
      if (moved.count === 0) throw new ApiError("ใบงานไม่อยู่ในสถานะรออนุมัติใบเสนอราคา", 409);

      return tx.quotation.findUnique({ where: { id: quotationId } });
    });

    return successResponse(updatedQuotation);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[QUOTATION_ACTION_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาด", 500);
  }
}
