// src/app/api/jobs/[id]/start/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/jobs/:id/start - UC12 เริ่มปฏิบัติงาน
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  if (payload.role !== "TECHNICIAN" && payload.role !== "HEAD_TECHNICIAN" && payload.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะช่างที่สามารถเริ่มปฏิบัติงานได้");
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "PLAN_APPROVED") {
    return errorResponse("ใบงานต้องอยู่ในสถานะ PLAN_APPROVED (แผนงานอนุมัติแล้ว) จึงจะเริ่มงานได้", 422);
  }

  // ตัดสต็อกอะไหล่จริงตามที่จองใน workPlan
  const workPlan = await prisma.workPlan.findUnique({
    where: { jobId: id },
    include: { materials: true },
  });

  try {
    await prisma.$transaction(async (tx) => {
      if (workPlan && workPlan.materials.length > 0) {
        for (const wpMat of workPlan.materials) {
          await tx.material.update({
            where: { id: wpMat.materialId },
            data: { stockQuantity: { decrement: wpMat.quantity } },
          });
        }
      }

      await tx.job.update({
        where: { id },
        data: { status: "IN_PROGRESS" },
      });
    });

    const updated = await prisma.job.findUnique({ where: { id } });
    return successResponse(updated, "เริ่มปฏิบัติงานสำเร็จและตัดสต็อกอะไหล่เรียบร้อย");
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาด", 500);
  }
}
