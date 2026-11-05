// src/lib/attachments.ts
// กฎไฟล์แนบของใบงาน: ใครแนบอะไรได้ ในขั้นไหนของงาน และชนิดไฟล์ที่รับ
// ไฟล์จริงอยู่ใน Supabase Storage (src/lib/storage.ts) — ตารางนี้เก็บแค่ metadata + สิทธิ์

import type { AttachmentCategory, JobStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import type { Role } from "@/lib/api-auth";
import type { JWTPayload } from "@/lib/auth";

export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_UPLOAD_GROUP = 10;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

type Rule = {
  label: string;
  roles: readonly Role[];
  jobStatuses: readonly JobStatus[]; // สถานะใบงานที่ยังแนบ/ลบไฟล์ได้
  mimeTypes: readonly string[];
  requiresAssignment: boolean; // ต้องเป็นช่างในแผนงาน (หรือหัวหน้าช่าง/ธุรการ)
};

export const ATTACHMENT_RULES: Record<AttachmentCategory, Rule> = {
  PAYMENT_SLIP: {
    label: "สลิปการชำระเงิน",
    roles: ["CUSTOMER", "ACCOUNTANT", "ADMIN"],
    jobStatuses: ["ACCEPTED"],
    mimeTypes: [...IMAGE_TYPES, "application/pdf"],
    requiresAssignment: false,
  },
  SURVEY: {
    label: "รูปสำรวจหน้างาน",
    roles: ["TECHNICIAN", "HEAD_TECHNICIAN"],
    jobStatuses: ["PENDING", "REQUEST_EDIT"],
    mimeTypes: IMAGE_TYPES,
    requiresAssignment: false,
  },
  SAFETY_CHECK: {
    label: "รูปทดสอบความปลอดภัย",
    roles: ["TECHNICIAN", "HEAD_TECHNICIAN", "ADMIN"],
    jobStatuses: ["IN_PROGRESS"],
    mimeTypes: IMAGE_TYPES,
    requiresAssignment: true,
  },
  WORK_BEFORE: {
    label: "รูปก่อนเริ่มงาน",
    roles: ["TECHNICIAN", "HEAD_TECHNICIAN", "ADMIN"],
    jobStatuses: ["PLAN_APPROVED", "IN_PROGRESS"],
    mimeTypes: IMAGE_TYPES,
    requiresAssignment: true,
  },
  WORK_AFTER: {
    label: "รูปหลังทำงานเสร็จ",
    roles: ["TECHNICIAN", "HEAD_TECHNICIAN", "ADMIN"],
    jobStatuses: ["IN_PROGRESS", "WAITING_ACCEPTANCE"],
    mimeTypes: IMAGE_TYPES,
    requiresAssignment: true,
  },
};

export const ATTACHMENT_CATEGORIES = Object.keys(ATTACHMENT_RULES) as AttachmentCategory[];

export function isAttachmentCategory(v: unknown): v is AttachmentCategory {
  return typeof v === "string" && v in ATTACHMENT_RULES;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** ตรวจชนิดไฟล์จาก magic bytes — ไม่เชื่อ Content-Type ที่ browser ส่งมา */
export function sniffMimeType(bytes: Uint8Array): string | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  )
    return "image/webp";
  if (b.length >= 4 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46) return "application/pdf"; // %PDF
  return null;
}

export function buildStoragePath(jobId: string, category: AttachmentCategory, mimeType: string): string {
  return `jobs/${jobId}/${category.toLowerCase()}/${crypto.randomUUID()}.${EXT[mimeType] ?? "bin"}`;
}

/** ผู้ใช้เปิดดูไฟล์ของใบงานนี้ได้ไหม — พนักงานทุกคนดูได้, ลูกค้าดูได้เฉพาะงานของตัวเอง */
export function canViewJobFiles(auth: JWTPayload, job: { customerId: string }): boolean {
  if (auth.role === "CUSTOMER") return job.customerId === auth.sub;
  return true;
}

export function uploaderFields(auth: JWTPayload) {
  return auth.role === "CUSTOMER"
    ? { uploadedByCustomerId: auth.sub, uploadedByEmployeeId: null }
    : { uploadedByEmployeeId: auth.sub, uploadedByCustomerId: null };
}

/**
 * ผูกไฟล์ที่แนบไว้ชั่วคราวเข้ากับเอกสาร (ผลสำรวจ / ผลทดสอบ / การชำระเงิน) ใน transaction เดียวกัน
 * รับเฉพาะไฟล์ของใบงานนี้ หมวดนี้ ที่ผู้ใช้คนนี้อัปโหลดเอง และยังไม่ถูกผูกกับเอกสารอื่น
 */
export async function linkAttachments(
  tx: Prisma.TransactionClient,
  params: {
    ids: string[] | undefined;
    jobId: string;
    category: AttachmentCategory;
    auth: JWTPayload;
    link: { surveyId: string } | { safetyCheckId: string } | { paymentId: string };
  }
): Promise<number> {
  const ids = [...new Set(params.ids ?? [])];
  if (ids.length === 0) return 0;
  if (ids.length > MAX_ATTACHMENTS_PER_UPLOAD_GROUP) {
    throw new ApiError(`แนบไฟล์ได้ไม่เกิน ${MAX_ATTACHMENTS_PER_UPLOAD_GROUP} ไฟล์ต่อครั้ง`, 422);
  }
  const linked = await tx.attachment.updateMany({
    where: {
      id: { in: ids },
      jobId: params.jobId,
      category: params.category,
      surveyId: null,
      safetyCheckId: null,
      paymentId: null,
      ...uploaderFields(params.auth),
    },
    data: params.link,
  });
  if (linked.count !== ids.length) {
    throw new ApiError("ไฟล์แนบบางรายการไม่ถูกต้องหรือถูกใช้ไปแล้ว กรุณาอัปโหลดใหม่", 422);
  }
  return linked.count;
}

/** รายการ id ไฟล์แนบจาก body (ถ้าไม่ใช่ array ของ string ถือว่าไม่มี) */
export function parseAttachmentIds(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= 64);
}
