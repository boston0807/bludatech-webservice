// src/app/api/jobs/[id]/start/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { ApiError, successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

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
    include: { materials: { include: { material: true } } },
  });

  try {
    await prisma.$transaction(async (tx) => {
      // เปลี่ยนสถานะแบบมีเงื่อนไขก่อน กันการตัดสต็อกซ้ำเมื่อกดเริ่มงานพร้อมกัน
      const started = await tx.job.updateMany({
        where: { id, status: "PLAN_APPROVED" },
        data: { status: "IN_PROGRESS" },
      });
      if (started.count === 0) {
        throw new ApiError("ใบงานนี้เริ่มปฏิบัติงานไปแล้ว", 409);
      }

      if (workPlan && workPlan.materials.length > 0) {
        for (const wpMat of workPlan.materials) {
          // ตัดสต็อกเฉพาะเมื่อมีของเพียงพอ ถ้าไม่พอจะ rollback ทั้ง transaction
          const deducted = await tx.material.updateMany({
            where: { id: wpMat.materialId, stockQuantity: { gte: wpMat.quantity } },
            data: { stockQuantity: { decrement: wpMat.quantity } },
          });
          if (deducted.count === 0) {
            throw new ApiError(`อะไหล่ "${wpMat.material.materialName}" ในคลังไม่เพียงพอ`, 422);
          }
        }
      }
    });

    const updated = await prisma.job.findUnique({ where: { id } });
    return successResponse(updated, "เริ่มปฏิบัติงานสำเร็จและตัดสต็อกอะไหล่เรียบร้อย");
  } catch (error: any) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    return errorResponse(error.message || "เกิดข้อผิดพลาด", 500);
  }
}
