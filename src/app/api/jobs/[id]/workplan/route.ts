// src/app/api/jobs/[id]/workplan/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { createWorkPlanSchema } from "@/lib/validations/workplan";

type Params = { params: Promise<{ id: string }> };

// POST /api/jobs/:id/workplan - UC08 ทำแผนงานและจองอุปกรณ์
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  if (payload.role !== "HEAD_TECHNICIAN" && payload.role !== "TECHNICIAN" && payload.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะหัวหน้าช่างหรือช่างที่สามารถทำแผนงานได้");
  }

  const { id: jobId } = await params;
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "APPROVE") {
    return errorResponse("ใบงานต้องอยู่ในสถานะ APPROVE (ลูกนอนุมัติใบเสนอราคาแล้ว) จึงจะทำแผนงานได้", 422);
  }

  const body = await req.json();
  const parsed = createWorkPlanSchema.safeParse({ ...body, jobId });
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422);
  }

  const { surveyId, location, startDate, endDate, materials } = parsed.data;
  const startDateTime = new Date(startDate);
  const endDateTime = endDate ? new Date(endDate) : startDateTime;

  try {
    const workPlan = await prisma.$transaction(async (tx) => {
      // สร้างหรืออัปเดต WorkPlan สำหรับ Job นี้
      const existingPlan = await tx.workPlan.findUnique({ where: { jobId } });
      
      let plan;
      if (existingPlan) {
        plan = await tx.workPlan.update({
          where: { jobId },
          data: {
            surveyId,
            location: location || job.jobAddress,
            startDate: startDateTime,
            endDate: endDateTime,
            status: "DRAFT",
          },
        });
        // ลบ materials เก่าออกก่อน
        await tx.workPlanMaterial.deleteMany({ where: { planId: plan.id } });
      } else {
        plan = await tx.workPlan.create({
          data: {
            jobId,
            surveyId,
            location: location || job.jobAddress,
            startDate: startDateTime,
            endDate: endDateTime,
            status: "DRAFT",
          },
        });
      }

      // บันทึกจองอะไหล่
      if (materials && materials.length > 0) {
        for (const item of materials) {
          await tx.workPlanMaterial.create({
            data: {
              planId: plan.id,
              materialId: item.materialId,
              quantity: item.quantity,
            },
          });
        }
      }

      return plan;
    });

    const fullPlan = await prisma.workPlan.findUnique({
      where: { id: workPlan.id },
      include: { materials: { include: { material: true } } },
    });

    return successResponse(fullPlan, "สร้างแผนงานและจองอุปกรณ์สำเร็จ");
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาดในการสร้างแผนงาน", 500);
  }
}

// GET /api/jobs/:id/workplan
export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id: jobId } = await params;
  const workPlan = await prisma.workPlan.findUnique({
    where: { jobId },
    include: { materials: { include: { material: true } }, survey: true },
  });

  if (!workPlan) return notFoundResponse("ไม่พบแผนงานสำหรับใบงานนี้");
  return successResponse(workPlan);
}
