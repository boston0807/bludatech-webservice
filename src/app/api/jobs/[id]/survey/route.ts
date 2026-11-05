// src/app/api/jobs/[id]/survey/route.ts
// UC05 สำรวจและประเมินหน้างาน — บันทึกผลสำรวจ + รายการอะไหล่ในครั้งเดียว (rollback ทั้งหมดถ้าพัง)
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
import { createSurveySchema } from "@/lib/validations/survey";
import { transitionJob } from "@/lib/job-status";
import { Notify } from "@/lib/notifications";
import { linkAttachments, parseAttachmentIds } from "@/lib/attachments";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!["HEAD_TECHNICIAN", "TECHNICIAN"].includes(auth.role)) return forbiddenResponse();

  const { id: jobId } = await params;
  const job = await prisma.job.findUnique({ where: { id: jobId }, include: { customer: { select: { customerName: true } } } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "PENDING" && job.status !== "REQUEST_EDIT") {
    return errorResponse("ใบงานนี้ไม่อยู่ในสถานะที่บันทึกการสำรวจได้", 422);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createSurveySchema.safeParse({ ...body, jobId });
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { method, note, expenses } = parsed.data;

  // งานติดตั้งต้องวัดขนาดบ่อลิฟต์/โครงสร้างจริง จึงต้องลงพื้นที่เสมอ
  if (method === "REMOTE" && job.jobType === "INSTALLATION") {
    return errorResponse("งานติดตั้งลิฟต์ต้องลงพื้นที่สำรวจหน้างานเสมอ", 422);
  }

  try {
    const survey = await prisma.$transaction(async (tx) => {
      await transitionJob(tx, {
        jobId,
        to: "PASS_SURVEY",
        role: auth.role,
        conflictMessage: "ใบงานนี้ไม่อยู่ในสถานะที่บันทึกการสำรวจได้",
      });

      const created = await tx.survey.create({
        data: { jobId, technicianId: auth.sub, method, note: note?.trim() || null },
      });

      // รูปถ่ายหน้างานที่อัปโหลดไว้ก่อนกดบันทึก
      await linkAttachments(tx, {
        ids: parseAttachmentIds(body?.attachmentIds),
        jobId,
        category: "SURVEY",
        auth,
        link: { surveyId: created.id },
      });

      if (expenses?.length) {
        // สำรวจใหม่หลังลูกค้าขอแก้ไข (REQUEST_EDIT) → รายการประเมินใหม่แทนที่รายการเดิมทั้งหมด
        if (job.status === "REQUEST_EDIT") await tx.expense.deleteMany({ where: { jobId } });
        await tx.expense.createMany({
          data: expenses.map((e) => ({ jobId, expenseName: e.expenseName, quantity: e.quantity, price: e.price })),
        });
      }
      return created;
    });

    await Notify.surveyDone({ jobId, customerName: job.customer.customerName, byEmployeeId: auth.sub });

    return successResponse(survey, 201);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[CREATE_SURVEY_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}
