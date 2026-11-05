// src/app/api/jobs/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// GET /api/jobs/:id
export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id } = await params;

  const job = await prisma.job.findUnique({
    where: { id },
    include: {
      customer: { select: { customerName: true, customerPhone: true, customerEmail: true, customerAddress: true } },
      installation: true,
      repair: true,
      service: true,
      surveys: { include: { technician: { select: { employeeName: true } } } },
      expenses: true,
      quotation: true,
      workPlan: {
        include: {
          materials: { include: { material: true } },
          technicians: { include: { employee: { select: { id: true, employeeName: true, role: true } } } },
        },
      },
      receipt: { include: { payments: true } },
      safetyChecks: {
        orderBy: { checkedAt: "desc" },
        include: { technician: { select: { employeeName: true } } },
      },
      parentJob: { select: { id: true, jobAddress: true } },
    },
  });

  if (!job) return notFoundResponse("ไม่พบใบงาน");

  // Customer เห็นเฉพาะ job ของตัวเอง
  if (payload.role === "CUSTOMER" && job.customerId !== payload.sub) {
    return forbiddenResponse();
  }

  // ใบแจ้งหนี้ร่างยังไม่ผ่านการตรวจสอบจากฝ่ายบัญชี → ลูกค้ายังไม่เห็น
  if (payload.role === "CUSTOMER" && job.receipt?.status === "DRAFT") {
    return successResponse({ ...job, receipt: null, invoicePendingReview: true });
  }

  return successResponse(job);
}
