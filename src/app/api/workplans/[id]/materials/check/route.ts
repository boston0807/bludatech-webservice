// src/app/api/workplans/[id]/materials/check/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, unauthorizedResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// GET /api/workplans/:id/materials/check - UC10 ตรวจสอบอะไหล่และอุปกรณ์
export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id } = await params;
  const workPlan = await prisma.workPlan.findUnique({
    where: { id },
    include: { materials: { include: { material: true } } },
  });

  if (!workPlan) return notFoundResponse("ไม่พบแผนงาน");

  let isReady = true;
  const itemsCheck = workPlan.materials.map((item) => {
    const sufficient = item.material.stockQuantity >= item.quantity;
    if (!sufficient) isReady = false;
    return {
      materialId: item.materialId,
      materialName: item.material.materialName,
      requiredQuantity: item.quantity,
      stockQuantity: item.material.stockQuantity,
      sufficient,
    };
  });

  return successResponse({
    planId: workPlan.id,
    jobId: workPlan.jobId,
    isReady,
    items: itemsCheck,
  });
}
