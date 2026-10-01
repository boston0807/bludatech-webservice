// src/app/api/jobs/[id]/safety-check/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// POST /api/jobs/:id/safety-check - UC13 ทดสอบระบบและตรวจสอบความปลอดภัย
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  if (payload.role !== "TECHNICIAN" && payload.role !== "HEAD_TECHNICIAN" && payload.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะช่างที่สามารถบันทึกผลตรวจสอบความปลอดภัยได้");
  }

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "IN_PROGRESS") {
    return errorResponse("ใบงานต้องอยู่ในสถานะ IN_PROGRESS จึงจะทดสอบความปลอดภัยได้", 422);
  }

  const body = await req.json();
  const { passed, note } = body;

  if (passed === undefined) {
    return errorResponse("กรุณาระบุผลการทดสอบ (passed: true/false)", 422);
  }

  try {
    const newStatus = passed ? "WAITING_ACCEPTANCE" : "IN_PROGRESS"; // ถ้าไม่ผ่าน วนกลับไปทำต่อ IN_PROGRESS
    const updated = await prisma.job.update({
      where: { id },
      data: {
        status: newStatus,
        jobNote: note ? `${job.jobNote || ''}\n[Safety Check]: ${note} (${passed ? 'PASS' : 'FAIL'})` : job.jobNote,
      },
    });

    return successResponse(updated, passed ? "ทดสอบความปลอดภัยผ่าน ส่งมอบให้ลูกค้าตรวจรับงาน" : "ทดสอบไม่ผ่าน กรุณาแก้ไขและทดสอบใหม่");
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาด", 500);
  }
}
