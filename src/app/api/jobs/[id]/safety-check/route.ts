// src/app/api/jobs/[id]/safety-check/route.ts
// UC13 ทดสอบระบบและเช็กความปลอดภัย ตาม Safety Checklist มาตรฐาน
//   ผ่านครบทุกข้อ → บันทึกผล (PASS) ต่อท้าย job_note และเปลี่ยนเป็น WAITING_ACCEPTANCE (แจ้งลูกค้ามาตรวจรับ)
//   ไม่ผ่านบางข้อ → ไม่บันทึก งานยังเป็น IN_PROGRESS ให้ช่างแก้ไขตาม UC12 แล้วทดสอบใหม่ (Alternative Flow 3a)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { sendWaitingAcceptanceEmail } from "@/lib/email";
import { appendSafetyResultToNote, parseSafetyItems, SAFETY_CHECKLIST } from "@/lib/safety-checklist";

type Params = { params: Promise<{ id: string }> };

// GET — รายการตรวจมาตรฐาน
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  const { id } = await params;

  const job = await prisma.job.findUnique({ where: { id }, select: { customerId: true } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (auth.role === "CUSTOMER" && job.customerId !== auth.sub) return forbiddenResponse();

  return successResponse({ checklist: SAFETY_CHECKLIST });
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "TECHNICIAN" && auth.role !== "HEAD_TECHNICIAN" && auth.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะช่างที่สามารถบันทึกผลตรวจสอบความปลอดภัยได้");
  }

  const { id } = await params;
  // UC13 ข้อ 1
  const job = await prisma.job.findUnique({ where: { id }, include: { customer: true } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "IN_PROGRESS") {
    return errorResponse("ใบงานต้องอยู่ในสถานะ IN_PROGRESS จึงจะทดสอบความปลอดภัยได้", 422);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = parseSafetyItems(body?.items);
  if (!parsed.ok) return errorResponse(parsed.message, 422);

  // Alternative Flow 3a: ทดสอบไม่ผ่าน → ไม่บันทึก งานยังคงเป็น IN_PROGRESS
  if (!parsed.passed) {
    const failed = parsed.items.filter((i) => !i.passed).map((i) => `${i.label}${i.remark ? ` (${i.remark})` : ""}`);
    return errorResponse(
      `ทดสอบไม่ผ่าน ${failed.length} ข้อ: ${failed.join(", ")} — กรุณาแก้ไขแล้วทดสอบใหม่`,
      422
    );
  }

  const note = typeof body?.note === "string" && body.note.trim() ? body.note.trim().slice(0, 1000) : null;

  try {
    const technician = await prisma.employee.findUnique({ where: { id: auth.sub }, select: { employeeName: true } });
    const jobNote = appendSafetyResultToNote(job.jobNote, {
      items: parsed.items,
      note,
      technicianName: technician?.employeeName ?? auth.name ?? "ช่าง",
      checkedAt: new Date(),
    });

    // UC13 ข้อ 5: UPDATE jobs SET status = 'WAITING_ACCEPTANCE', job_note = $1 WHERE job_id = $2 (แบบมีเงื่อนไข กันกดซ้ำ)
    const moved = await prisma.job.updateMany({
      where: { id, status: "IN_PROGRESS" },
      data: { status: "WAITING_ACCEPTANCE", jobNote },
    });
    if (moved.count === 0) return errorResponse("สถานะใบงานเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่", 409);

    // UC13 ข้อ 6: แจ้งลูกค้ามาตรวจรับงาน (UC14)
    if (job.customer.customerEmail) {
      sendWaitingAcceptanceEmail({
        to: job.customer.customerEmail,
        customerName: job.customer.customerName,
        jobId: id,
      });
    }

    const updatedJob = await prisma.job.findUnique({ where: { id } });
    return successResponse({ job: updatedJob }, "ทดสอบความปลอดภัยผ่านครบทุกข้อ ส่งมอบให้ลูกค้าตรวจรับงาน");
  } catch (error) {
    console.error("[SAFETY_CHECK_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกผลตรวจสอบ", 500);
  }
}
