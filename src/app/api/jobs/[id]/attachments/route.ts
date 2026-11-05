// src/app/api/jobs/[id]/attachments/route.ts
// GET  — รายการไฟล์แนบของใบงาน (?category=WORK_AFTER)
// POST — อัปโหลดไฟล์ (multipart/form-data: file, category, caption?) ไป Supabase Storage
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
import {
  ATTACHMENT_RULES,
  MAX_ATTACHMENT_BYTES,
  buildStoragePath,
  canViewJobFiles,
  isAttachmentCategory,
  sniffMimeType,
  uploaderFields,
} from "@/lib/attachments";
import { canWorkOnPlan } from "@/lib/work-schedule";
import { removeObject, uploadObject } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

const ATTACHMENT_SELECT = {
  id: true,
  category: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  caption: true,
  createdAt: true,
  surveyId: true,
  safetyCheckId: true,
  paymentId: true,
  uploadedByEmployee: { select: { employeeName: true } },
  uploadedByCustomer: { select: { customerName: true } },
} as const;

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { id: jobId } = await params;
  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { customerId: true } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (!canViewJobFiles(auth, job)) return forbiddenResponse();

  const categoryParam = req.nextUrl.searchParams.get("category");
  if (categoryParam && !isAttachmentCategory(categoryParam)) return errorResponse("ประเภทไฟล์ไม่ถูกต้อง", 422);
  const category = categoryParam && isAttachmentCategory(categoryParam) ? categoryParam : undefined;

  const attachments = await prisma.attachment.findMany({
    where: { jobId, ...(category ? { category } : {}) },
    orderBy: { createdAt: "asc" },
    select: ATTACHMENT_SELECT,
  });
  return successResponse(attachments);
}

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { id: jobId } = await params;
  const form = await req.formData().catch(() => null);
  if (!form) return errorResponse("กรุณาส่งไฟล์แบบ multipart/form-data", 422);

  const category = form.get("category");
  const file = form.get("file");
  const captionRaw = form.get("caption");
  if (!isAttachmentCategory(category)) return errorResponse("ประเภทไฟล์ไม่ถูกต้อง", 422);
  if (!(file instanceof File) || file.size === 0) return errorResponse("กรุณาเลือกไฟล์", 422);
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return errorResponse(`ไฟล์ใหญ่เกิน ${MAX_ATTACHMENT_BYTES / 1024 / 1024} MB`, 422);
  }

  const rule = ATTACHMENT_RULES[category];
  if (!rule.roles.includes(auth.role)) return forbiddenResponse(`คุณไม่มีสิทธิ์แนบ${rule.label}`);

  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      customerId: true,
      status: true,
      receipt: { select: { status: true } },
      workPlan: { select: { technicians: { select: { employeeId: true } } } },
    },
  });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (auth.role === "CUSTOMER" && job.customerId !== auth.sub) return forbiddenResponse();
  if (!rule.jobStatuses.includes(job.status)) {
    return errorResponse(`ใบงานอยู่ในขั้นที่แนบ${rule.label}ไม่ได้แล้ว`, 422);
  }
  if (category === "PAYMENT_SLIP" && job.receipt?.status !== "UNPAID") {
    return errorResponse("ใบแจ้งหนี้นี้ไม่อยู่ในสถานะรอชำระเงิน", 422);
  }
  if (rule.requiresAssignment) {
    const assigned = job.workPlan?.technicians.map((t) => t.employeeId) ?? [];
    if (!canWorkOnPlan(auth.role, auth.sub, assigned)) {
      return forbiddenResponse("งานนี้ไม่ได้มอบหมายให้คุณ");
    }
  }

  const bytes = await file.arrayBuffer();
  const mimeType = sniffMimeType(new Uint8Array(bytes.slice(0, 16)));
  if (!mimeType || !rule.mimeTypes.includes(mimeType)) {
    return errorResponse(
      rule.mimeTypes.includes("application/pdf") ? "รองรับเฉพาะไฟล์ JPG, PNG, WEBP หรือ PDF" : "รองรับเฉพาะรูปภาพ JPG, PNG หรือ WEBP",
      422
    );
  }

  const storagePath = buildStoragePath(jobId, category, mimeType);
  try {
    await uploadObject(storagePath, bytes, mimeType);
  } catch (error) {
    console.error("[ATTACHMENT_UPLOAD_ERROR]", error);
    return errorResponse("อัปโหลดไฟล์ไม่สำเร็จ กรุณาลองใหม่", 502);
  }

  try {
    const attachment = await prisma.attachment.create({
      data: {
        jobId,
        category,
        storagePath,
        fileName: file.name.slice(0, 200) || "file",
        mimeType,
        sizeBytes: file.size,
        caption: typeof captionRaw === "string" && captionRaw.trim() ? captionRaw.trim().slice(0, 300) : null,
        ...uploaderFields(auth),
      },
      select: ATTACHMENT_SELECT,
    });
    return successResponse(attachment, 201);
  } catch (error) {
    // บันทึกฐานข้อมูลไม่สำเร็จ → ลบไฟล์ที่อัปโหลดไปแล้ว ไม่ให้ค้างใน bucket
    await removeObject(storagePath);
    console.error("[ATTACHMENT_CREATE_ERROR]", error);
    return errorResponse("บันทึกไฟล์แนบไม่สำเร็จ", 500);
  }
}
