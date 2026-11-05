// src/app/api/jobs/[id]/safety-check/route.ts
// UC13 ทดสอบระบบและเช็กความปลอดภัย ตาม Safety Checklist มาตรฐาน
//   ผ่านครบทุกข้อ → WAITING_ACCEPTANCE (แจ้งลูกค้ามาตรวจรับ)
//   ไม่ผ่านบางข้อ → ยังเป็น IN_PROGRESS ให้ช่างแก้ไขแล้วทดสอบใหม่ (ผลทุกรอบถูกเก็บไว้)
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
import { sendWaitingAcceptanceEmail } from "@/lib/email";
import { parseSafetyItems, SAFETY_CHECKLIST } from "@/lib/safety-checklist";
import { canWorkOnPlan } from "@/lib/work-schedule";

type Params = { params: Promise<{ id: string }> };

// GET — รายการตรวจมาตรฐาน + ประวัติผลตรวจของงานนี้
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id }, select: { customerId: true } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (auth.role === "CUSTOMER" && job.customerId !== auth.sub) return forbiddenResponse();

  const checks = await prisma.safetyCheck.findMany({
    where: { jobId: id },
    orderBy: { checkedAt: "desc" },
    include: { technician: { select: { employeeName: true } } },
  });
  return successResponse({ checklist: SAFETY_CHECKLIST, checks });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TECHNICIAN" && auth.role !== "HEAD_TECHNICIAN" && auth.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะช่างที่สามารถบันทึกผลตรวจสอบความปลอดภัยได้");
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({
    where: { id },
    include: { customer: true, workPlan: { include: { technicians: true } } },
  });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "IN_PROGRESS") {
    return errorResponse("ใบงานต้องอยู่ในสถานะ IN_PROGRESS จึงจะทดสอบความปลอดภัยได้", 422);
  }

  const assignedIds = job.workPlan?.technicians.map((t) => t.employeeId) ?? [];
  if (!canWorkOnPlan(auth.role, auth.sub, assignedIds)) {
    return forbiddenResponse("งานนี้ไม่ได้มอบหมายให้คุณ กรุณาติดต่อหัวหน้าช่าง");
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseSafetyItems(body?.items);
  if (!parsed.ok) return errorResponse(parsed.message, 422);

  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null;
  const technicianId = auth.sub; // ผู้บันทึกผล (employee_id จาก token)

  try {
    const result = await prisma.$transaction(async (tx) => {
      const check = await tx.safetyCheck.create({
        data: { jobId: id, technicianId, passed: parsed.passed, items: parsed.items, note },
      });

      if (parsed.passed) {
        const moved = await tx.job.updateMany({
          where: { id, status: "IN_PROGRESS" },
          data: { status: "WAITING_ACCEPTANCE" },
        });
        if (moved.count === 0) throw new ApiError("สถานะใบงานเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่", 409);
      }

      const updatedJob = await tx.job.findUnique({ where: { id } });
      return { job: updatedJob, check };
    });

    if (parsed.passed && job.customer.customerEmail) {
      sendWaitingAcceptanceEmail({
        to: job.customer.customerEmail,
        customerName: job.customer.customerName,
        jobId: id,
      });
    }

    const failed = parsed.items.filter((i) => !i.passed).map((i) => i.label);
    return successResponse(
      result,
      parsed.passed
        ? "ทดสอบความปลอดภัยผ่านครบทุกข้อ ส่งมอบให้ลูกค้าตรวจรับงาน"
        : `ทดสอบไม่ผ่าน ${failed.length} ข้อ (${failed.join(", ")}) กรุณาแก้ไขแล้วทดสอบใหม่`
    );
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[SAFETY_CHECK_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกผลตรวจสอบ", 500);
  }
}
