// src/app/api/jobs/[id]/accept/route.ts
// UC14 ตรวจรับงาน
//   ACCEPT → ACCEPTED และระบบออกใบแจ้งหนี้ร่าง (DRAFT) ให้อัตโนมัติ รอบัญชีตรวจสอบ (BP ข้อ 17)
//   REJECT → กลับไป IN_PROGRESS พร้อมเหตุผล ให้ช่างแก้ไขแล้วทดสอบความปลอดภัยใหม่ (BP ข้อ 16 → 14)
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import {
  ApiError,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { sendReworkRequestedEmail } from "@/lib/email-notifications";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    action: z.enum(["ACCEPT", "REJECT"]).default("ACCEPT"),
    note: z.string().max(1000).optional(),
  })
  .refine((d) => d.action !== "REJECT" || (d.note && d.note.trim().length > 0), {
    message: "กรุณาระบุสิ่งที่ต้องการให้ช่างแก้ไข",
    path: ["note"],
  });

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id }, include: { quotation: true, receipt: true, customer: { select: { customerName: true } } },
  });
  if (!job) return notFoundResponse("ไม่พบใบงาน");

  if (auth.role !== "CUSTOMER" || job.customerId !== auth.sub) {
    return forbiddenResponse();
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { action, note } = parsed.data;

  try {
    if (action === "REJECT") {
      const updated = await prisma.$transaction(async (tx) => {
        const moved = await tx.job.updateMany({
          where: { id, status: "WAITING_ACCEPTANCE" },
          data: { status: "IN_PROGRESS", reworkNote: note!.trim() },
        });
        if (moved.count === 0) throw new ApiError("ใบงานยังไม่พร้อมให้ตรวจรับ", 422);
        return tx.job.findUnique({ where: { id } });
      });
      sendReworkRequestedEmail({
        customerName: job.customer.customerName,
        jobId: id,
        jobAddress: job.jobAddress,
        reworkNote: note!.trim(),
      });
      return successResponse(updated, "ส่งงานกลับให้ช่างแก้ไขแล้ว");
    }

    const result = await prisma.$transaction(async (tx) => {
      const moved = await tx.job.updateMany({
        where: { id, status: "WAITING_ACCEPTANCE" },
        data: { status: "ACCEPTED", reworkNote: null },
      });
      if (moved.count === 0) throw new ApiError("ใบงานยังไม่พร้อมให้ตรวจรับ", 422);
      await tx.workPlan.updateMany({ where: { jobId: id }, data: { status: "FINISHED" } });

      // ออกใบแจ้งหนี้ร่างอัตโนมัติจากยอดใบเสนอราคาที่อนุมัติแล้ว (ถ้ายอด 0 ไม่ต้องเก็บเงิน → ไม่ออก)
      let receipt = job.receipt;
      const amount = job.quotation?.status === "APPROVED" ? job.quotation.totalAmount : null;
      if (!receipt && amount && amount.greaterThan(0)) {
        receipt = await tx.receipt.create({
          data: { jobId: id, totalAmount: amount, status: "DRAFT" },
        });
      }

      const updatedJob = await tx.job.findUnique({ where: { id } });
      return { job: updatedJob, receipt };
    });

    return successResponse(result, "ตรวจรับงานสำเร็จ ระบบส่งข้อมูลให้ฝ่ายบัญชีออกใบแจ้งหนี้แล้ว");
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[ACCEPT_JOB_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการตรวจรับงาน", 500);
  }
}
