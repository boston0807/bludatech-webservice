// src/app/api/workplans/[id]/approve/route.ts
// UC09 อนุมัติแผนการทำงาน
//   APPROVE → แผน APPROVED, งาน PLAN_APPROVED
//   REJECT  → แผน REJECTED พร้อมเหตุผล งานยังเป็น APPROVE ให้หัวหน้าช่างแก้แผนแล้วส่งใหม่ (BP ข้อ 11 → 9)
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
import { transitionJob } from "@/lib/job-status";
import { Notify } from "@/lib/notifications";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]).default("APPROVE"),
    rejectNote: z.string().max(1000).optional(),
  })
  .refine((d) => d.action !== "REJECT" || (d.rejectNote && d.rejectNote.trim().length > 0), {
    message: "กรุณาระบุเหตุผลหรือสิ่งที่ต้องการให้ปรับแผน",
    path: ["rejectNote"],
  });

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "CUSTOMER") {
    return forbiddenResponse("เฉพาะลูกค้าเท่านั้นที่สามารถอนุมัติแผนงานได้");
  }

  const { id } = await params;
  const workPlan = await prisma.workPlan.findUnique({
    where: { id },
    include: { job: { include: { customer: { select: { customerName: true } } } }, technicians: true },
  });
  if (!workPlan) return notFoundResponse("ไม่พบแผนงาน");
  if (workPlan.job.customerId !== auth.sub) {
    return forbiddenResponse("คุณไม่มีสิทธิ์อนุมัติแผนงานนี้");
  }

  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw ?? {});
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { action, rejectNote } = parsed.data;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // อัปเดตแบบมีเงื่อนไข กันกดซ้ำหรือกดพร้อมกันหลายแท็บ
      const changed = await tx.workPlan.updateMany({
        where: { id, status: "DRAFT", job: { status: "APPROVE" } },
        data:
          action === "APPROVE"
            ? { status: "APPROVED", rejectNote: null }
            : { status: "REJECTED", rejectNote: rejectNote!.trim() },
      });
      if (changed.count === 0) throw new ApiError("แผนงานนี้ไม่อยู่ในสถานะที่อนุมัติได้", 422);

      if (action === "APPROVE") {
        await transitionJob(tx, { jobId: workPlan.jobId, to: "PLAN_APPROVED", role: auth.role });
      }
      return tx.workPlan.findUnique({ where: { id } });
    });

    const customerName = workPlan.job.customer.customerName;
    if (action === "APPROVE") {
      await Notify.workPlanApproved({
        jobId: workPlan.jobId,
        customerName,
        technicianIds: workPlan.technicians.map((t) => t.employeeId),
      });
    } else {
      await Notify.workPlanRejected({ jobId: workPlan.jobId, customerName, note: rejectNote!.trim() });
    }

    return successResponse(
      updated,
      action === "APPROVE" ? "อนุมัติแผนงานสำเร็จ" : "ส่งแผนงานกลับให้หัวหน้าช่างปรับปรุงแล้ว"
    );
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[WORKPLAN_APPROVE_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการอนุมัติแผนงาน", 500);
  }
}
