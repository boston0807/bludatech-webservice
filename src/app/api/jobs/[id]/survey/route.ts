// src/app/api/jobs/[id]/survey/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { createSurveySchema } from "@/lib/validations/survey";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload || !["HEAD_TECHNICIAN", "TECHNICIAN"].includes(payload.role)) return forbiddenResponse();

  const { id: jobId } = await params;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");

  const body = await req.json();
  const parsed = createSurveySchema.safeParse({ ...body, jobId });
  if (!parsed.success) {
    return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  }

  try {
    // สร้าง survey
    const survey = await prisma.survey.create({
      data: {
        jobId,
        technicianId: payload.sub,
        note: parsed.data.note ?? null,
      },
    });

    // อัปเดต job status → PASS_SURVEY
    await prisma.job.update({
      where: { id: jobId },
      data: { status: "PASS_SURVEY" },
    });

    return successResponse(survey, 201);
  } catch (error) {
    console.error("[CREATE_SURVEY_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}
