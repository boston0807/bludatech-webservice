// src/app/api/jobs/[id]/start/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import { ApiError, successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { canWorkOnPlan } from "@/lib/work-schedule";
import { canTransition, transitionJob } from "@/lib/job-status";
import { changeStock, InsufficientStockError } from "@/lib/materials";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/jobs/:id/start - UC12 เริ่มปฏิบัติงาน (ตัดสต็อกอะไหล่ที่จองไว้)
export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TECHNICIAN" && auth.role !== "HEAD_TECHNICIAN" && auth.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะช่างที่สามารถเริ่มปฏิบัติงานได้");
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (!canTransition(job.status, "IN_PROGRESS", auth.role)) {
    return errorResponse("ใบงานต้องอยู่ในสถานะ PLAN_APPROVED (แผนงานอนุมัติแล้ว) จึงจะเริ่มงานได้", 422);
  }

  const workPlan = await prisma.workPlan.findUnique({
    where: { jobId: id },
    include: { materials: { include: { material: true } }, technicians: true },
  });

  const assignedIds = workPlan?.technicians.map((t) => t.employeeId) ?? [];
  if (!canWorkOnPlan(auth.role, auth.sub, assignedIds)) {
    return forbiddenResponse("งานนี้ไม่ได้มอบหมายให้คุณ กรุณาติดต่อหัวหน้าช่าง");
  }

  try {
    await prisma.$transaction(async (tx) => {
      await transitionJob(tx, {
        jobId: id,
        to: "IN_PROGRESS",
        role: auth.role,
        conflictMessage: "ใบงานนี้เริ่มปฏิบัติงานไปแล้ว",
      });

      for (const wpMat of workPlan?.materials ?? []) {
        try {
          await changeStock(tx, {
            materialId: wpMat.materialId,
            change: -wpMat.quantity,
            reason: "JOB_USAGE",
            jobId: id,
            employeeId: auth.sub,
          });
        } catch (e) {
          if (!(e instanceof InsufficientStockError)) throw e;
          throw new ApiError(
            `อะไหล่ "${wpMat.material.materialName}" ในคลังไม่เพียงพอ (ต้องใช้ ${e.requested} คงเหลือ ${e.available}) — แจ้งฝ่ายบัญชีสั่งซื้อเพิ่มได้ที่หน้า "สั่งซื้ออุปกรณ์"`,
            422
          );
        }
      }

      if (workPlan) {
        await tx.workPlan.update({ where: { id: workPlan.id }, data: { status: "IN_PROGRESS" } });
      }
    });

    const updated = await prisma.job.findUnique({ where: { id } });
    return successResponse(updated, "เริ่มปฏิบัติงานสำเร็จและตัดสต็อกอะไหล่เรียบร้อย");
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[START_JOB_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการเริ่มปฏิบัติงาน", 500);
  }
}
