// src/app/api/jobs/[id]/workplan/route.ts
import { NextRequest } from "next/server";
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
import { createWorkPlanSchema } from "@/lib/validations/workplan";
import { sendWorkPlanCreatedEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// POST /api/jobs/:id/workplan - UC08 ทำแผนการทำงานและจองอุปกรณ์
// ถ้ามีแผนอยู่แล้ว (แผนร่าง หรือแผนที่ลูกค้าไม่อนุมัติ) จะปรับปรุงแผนเดิมแล้วส่งให้ลูกค้าอนุมัติใหม่
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  // UC08 actor = หัวหน้าช่าง (ธุรการทำแทนได้) — ช่างทั่วไปไม่มีสิทธิ์จัดแผน
  if (auth.role !== "HEAD_TECHNICIAN" && auth.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะหัวหน้าช่างที่สามารถทำแผนงานได้");
  }

  const { id: jobId } = await params;
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { customer: true } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "APPROVE") {
    return errorResponse("ใบงานต้องอยู่ในสถานะ APPROVE (ลูกค้าอนุมัติใบเสนอราคาแล้ว) จึงจะทำแผนงานได้", 422);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createWorkPlanSchema.safeParse({ ...body, jobId });
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }

  const { surveyId, location, startDate, endDate, materials } = parsed.data;
  const startDateTime = new Date(startDate);
  const endDateTime = endDate ? new Date(endDate) : startDateTime;
  if (materials?.length) {
    const found = await prisma.material.count({ where: { id: { in: materials.map((m) => m.materialId) } } });
    if (found !== materials.length) return errorResponse("พบรายการอะไหล่ที่ไม่มีในระบบ", 422);
  }

  try {
    const workPlan = await prisma.$transaction(async (tx) => {
      const existingPlan = await tx.workPlan.findUnique({ where: { jobId } });
      if (existingPlan && existingPlan.status === "APPROVED") {
        throw new ApiError("แผนงานนี้ได้รับการอนุมัติแล้ว ไม่สามารถแก้ไขได้", 409);
      }

      const data = {
        surveyId: surveyId || null,
        location: location || job.jobAddress,
        startDate: startDateTime,
        endDate: endDateTime,
        status: "DRAFT" as const,
        rejectNote: null,
      };

      let plan;
      if (existingPlan) {
        plan = await tx.workPlan.update({ where: { jobId }, data });
        await tx.workPlanMaterial.deleteMany({ where: { planId: plan.id } });
      } else {
        plan = await tx.workPlan.create({ data: { jobId, ...data } });
      }

      if (materials?.length) {
        await tx.workPlanMaterial.createMany({
          data: materials.map((m) => ({ planId: plan.id, materialId: m.materialId, quantity: m.quantity })),
        });
      }

      return plan;
    });

    const fullPlan = await prisma.workPlan.findUnique({
      where: { id: workPlan.id },
      include: { materials: { include: { material: true } } },
    });

    if (job.customer?.customerEmail) {
      sendWorkPlanCreatedEmail({
        to: job.customer.customerEmail,
        customerName: job.customer.customerName,
        jobId,
        location: workPlan.location ?? job.jobAddress,
        startDate: workPlan.startDate,
        endDate: workPlan.endDate,
      });
    }

    return successResponse(fullPlan, "สร้างแผนงานและจองอุปกรณ์สำเร็จ");
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[CREATE_WORKPLAN_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการสร้างแผนงาน", 500);
  }
}

// GET /api/jobs/:id/workplan
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { id: jobId } = await params;
  const workPlan = await prisma.workPlan.findUnique({
    where: { jobId },
    include: {
      job: { select: { customerId: true } },
      materials: { include: { material: true } },
      survey: true,
    },
  });

  if (!workPlan) return notFoundResponse("ไม่พบแผนงานสำหรับใบงานนี้");
  if (auth.role === "CUSTOMER" && workPlan.job.customerId !== auth.sub) return forbiddenResponse();
  return successResponse(workPlan);
}
