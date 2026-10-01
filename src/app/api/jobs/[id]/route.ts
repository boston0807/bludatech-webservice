// src/app/api/jobs/[id]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

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
      workPlan: { include: { materials: { include: { material: true } } } },
      receipt: { include: { payments: true } },
    },
  });

  if (!job) return notFoundResponse("ไม่พบใบงาน");

  // Customer เห็นเฉพาะ job ของตัวเอง
  if (payload.role === "CUSTOMER" && job.customerId !== payload.sub) {
    return forbiddenResponse();
  }

  return successResponse(job);
}

// PATCH /api/jobs/:id/status
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id } = await params;
  const body = await req.json();
  const { status, jobNote } = body;

  if (!status) return errorResponse("กรุณาระบุ status", 422);

  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");

  const updated = await prisma.job.update({
    where: { id },
    data: {
      status,
      ...(jobNote !== undefined ? { jobNote } : {}),
    },
  });

  return successResponse(updated);
}
