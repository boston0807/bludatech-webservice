// src/app/api/jobs/[id]/history/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from "@/lib/api-response";
import { saveJobHistory } from "@/lib/service-history";

type Params = { params: Promise<{ id: string }> };

// POST /api/jobs/:id/history - UC17 บันทึกประวัติการให้บริการ
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id: jobId } = await params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { quotation: true, workPlan: true, service: true },
  });

  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "PAID" && job.status !== "ACCEPTED") {
    return errorResponse("ใบงานยังไม่เสร็จสิ้นกระบวนการชำระเงิน", 422);
  }

  try {
    const history = await prisma.$transaction((tx) => saveJobHistory(tx, jobId));

    return successResponse(history, "บันทึกประวัติการให้บริการสำเร็จ");
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาด", 500);
  }
}

// GET /api/jobs/[id]/history or general customer history
export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id: jobId } = await params;
  const history = await prisma.serviceHistory.findFirst({
    where: { jobId },
  });

  if (!history) return notFoundResponse("ไม่พบประวัติ");
  return successResponse(history);
}
