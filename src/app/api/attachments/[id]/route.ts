// src/app/api/attachments/[id]/route.ts
// GET    — เปิดไฟล์: ตรวจสิทธิ์แล้ว redirect ไป signed URL อายุสั้น (ใช้กับ <img src> / <a href> ได้ตรง ๆ)
// DELETE — ลบไฟล์ที่ตัวเองอัปโหลด ขณะใบงานยังอยู่ในขั้นที่แนบไฟล์ได้ และยังไม่ถูกผูกกับเอกสาร
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { ATTACHMENT_RULES, canViewJobFiles } from "@/lib/attachments";
import { createSignedUrl, removeObject } from "@/lib/storage";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { job: { select: { customerId: true } } },
  });
  if (!attachment) return notFoundResponse("ไม่พบไฟล์");
  if (!canViewJobFiles(auth, attachment.job)) return forbiddenResponse();

  try {
    const url = await createSignedUrl(attachment.storagePath);
    const res = NextResponse.redirect(url, 302);
    // signed URL หมดอายุใน 5 นาที — ให้ browser cache redirect สั้นกว่านั้น
    res.headers.set("Cache-Control", "private, max-age=240");
    return res;
  } catch (error) {
    console.error("[ATTACHMENT_SIGN_ERROR]", error);
    return errorResponse("เปิดไฟล์ไม่สำเร็จ", 502);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { id } = await params;
  const attachment = await prisma.attachment.findUnique({
    where: { id },
    include: { job: { select: { status: true } } },
  });
  if (!attachment) return notFoundResponse("ไม่พบไฟล์");

  const isOwner =
    auth.role === "CUSTOMER" ? attachment.uploadedByCustomerId === auth.sub : attachment.uploadedByEmployeeId === auth.sub;
  if (!isOwner) return forbiddenResponse("ลบได้เฉพาะไฟล์ที่คุณอัปโหลดเอง");

  if (attachment.surveyId || attachment.safetyCheckId || attachment.paymentId) {
    return errorResponse("ไฟล์นี้ถูกบันทึกเป็นหลักฐานแล้ว ลบไม่ได้", 409);
  }
  if (!ATTACHMENT_RULES[attachment.category].jobStatuses.includes(attachment.job.status)) {
    return errorResponse("ใบงานผ่านขั้นนี้ไปแล้ว ลบไฟล์ไม่ได้", 409);
  }

  await prisma.attachment.delete({ where: { id } });
  await removeObject(attachment.storagePath);
  return successResponse({ id }, "ลบไฟล์แล้ว");
}
