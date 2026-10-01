// src/app/api/jobs/[id]/accept/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/jobs/:id/accept - UC14 ตรวจรับงานโดยลูกค้า
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id } = await params;
  const job = await prisma.job.findUnique({ where: { id } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");

  if (payload.role === "CUSTOMER" && job.customerId !== payload.sub) {
    return forbiddenResponse();
  }

  if (job.status !== "WAITING_ACCEPTANCE") {
    return errorResponse("ใบงานยังไม่พร้อมให้ตรวจรับ", 422);
  }

  const updated = await prisma.job.update({
    where: { id },
    data: { status: "ACCEPTED" },
  });

  return successResponse(updated, "ตรวจรับงานสำเร็จ");
}
