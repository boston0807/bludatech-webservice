// src/app/api/workplans/[id]/approve/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/workplans/:id/approve - UC09 อนุมัติแผนการทำงาน
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  if (payload.role !== "CUSTOMER") {
    return forbiddenResponse("เฉพาะลูกค้าเท่านั้นที่สามารถอนุมัติแผนงานได้");
  }

  const { id } = await params;
  const workPlan = await prisma.workPlan.findUnique({
    where: { id },
    include: { job: true, materials: { include: { material: true } } },
  });

  if (!workPlan) return notFoundResponse("ไม่พบแผนงาน");

  if (workPlan.job.customerId !== payload.sub) {
    return forbiddenResponse("คุณไม่มีสิทธิ์อนุมัติแผนงานนี้");
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // อัปเดตสถานะ WorkPlan เป็น APPROVED
      const plan = await tx.workPlan.update({
        where: { id },
        data: { status: "APPROVED" },
      });

      // อัปเดตสถานะ Job เป็น PLAN_APPROVED
      await tx.job.update({
        where: { id: workPlan.jobId },
        data: { status: "PLAN_APPROVED" },
      });

      return plan;
    });

    return successResponse(updated, "อนุมัติแผนงานสำเร็จ");
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาดในการอนุมัติแผนงาน", 500);
  }
}
