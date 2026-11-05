// src/lib/job-status.ts
// กฎการเปลี่ยนสถานะใบงาน (state machine) — แหล่งเดียวของ business process ทั้งหมด
// ทุก route ที่เปลี่ยน Job.status ต้องเรียก transitionJob() แทนการ update เอง
// เพื่อกันการกระโดดข้ามขั้น (เช่น PENDING → PAID) และกันกดซ้ำ/คำขอพร้อมกัน

import type { JobStatus, Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import type { Role } from "@/lib/api-auth";

type Rule = { from: JobStatus; to: JobStatus; roles: readonly Role[]; step: string };

const TECH: readonly Role[] = ["TECHNICIAN", "HEAD_TECHNICIAN"];
const FIELD: readonly Role[] = ["TECHNICIAN", "HEAD_TECHNICIAN", "ADMIN"];

export const JOB_TRANSITIONS: readonly Rule[] = [
  // UC05 สำรวจหน้างาน (รวมสำรวจใหม่หลังลูกค้าขอแก้ใบเสนอราคา)
  { from: "PENDING", to: "PASS_SURVEY", roles: TECH, step: "บันทึกผลสำรวจ" },
  { from: "REQUEST_EDIT", to: "PASS_SURVEY", roles: TECH, step: "สำรวจใหม่" },
  // UC06 ออกใบเสนอราคา
  { from: "PASS_SURVEY", to: "QUOTED", roles: ["ACCOUNTANT"], step: "ออกใบเสนอราคา" },
  { from: "REQUEST_EDIT", to: "QUOTED", roles: ["ACCOUNTANT"], step: "ออกใบเสนอราคาใหม่" },
  // UC07 ลูกค้าพิจารณาใบเสนอราคา
  { from: "QUOTED", to: "APPROVE", roles: ["CUSTOMER"], step: "อนุมัติใบเสนอราคา" },
  { from: "QUOTED", to: "REQUEST_EDIT", roles: ["CUSTOMER"], step: "ขอแก้ไขใบเสนอราคา" },
  { from: "QUOTED", to: "CANCELLED", roles: ["CUSTOMER"], step: "ยกเลิกงาน" },
  // UC09 ลูกค้าอนุมัติแผนงาน
  { from: "APPROVE", to: "PLAN_APPROVED", roles: ["CUSTOMER"], step: "อนุมัติแผนงาน" },
  // UC12 เริ่มงาน / UC13 ทดสอบความปลอดภัยผ่าน
  { from: "PLAN_APPROVED", to: "IN_PROGRESS", roles: FIELD, step: "เริ่มปฏิบัติงาน" },
  { from: "IN_PROGRESS", to: "WAITING_ACCEPTANCE", roles: FIELD, step: "ส่งมอบงาน" },
  // UC14 ตรวจรับงาน (ไม่ผ่าน → กลับไปแก้)
  { from: "WAITING_ACCEPTANCE", to: "ACCEPTED", roles: ["CUSTOMER"], step: "ตรวจรับงาน" },
  { from: "WAITING_ACCEPTANCE", to: "IN_PROGRESS", roles: ["CUSTOMER"], step: "ส่งงานกลับให้แก้ไข" },
  // UC16 ชำระเงิน
  { from: "ACCEPTED", to: "PAID", roles: ["CUSTOMER", "ACCOUNTANT", "ADMIN"], step: "ชำระเงิน" },
  // UC17 ธุรการบันทึกประวัติ (งานยอด 0 ไม่มีใบแจ้งหนี้ → ปิดจาก ACCEPTED ได้เลย)
  { from: "PAID", to: "COMPLETED", roles: ["ADMIN"], step: "บันทึกประวัติงาน" },
  { from: "ACCEPTED", to: "COMPLETED", roles: ["ADMIN"], step: "บันทึกประวัติงาน" },
];

/** สถานะต้นทางที่ role นี้เปลี่ยนไปเป็น `to` ได้ */
export function allowedFrom(to: JobStatus, role: Role): JobStatus[] {
  return JOB_TRANSITIONS.filter((r) => r.to === to && r.roles.includes(role)).map((r) => r.from);
}

export function canTransition(from: JobStatus, to: JobStatus, role: Role): boolean {
  return JOB_TRANSITIONS.some((r) => r.from === from && r.to === to && r.roles.includes(role));
}

/** ตรวจก่อนเริ่มทำงานหนัก (เช่น อ่าน body / คำนวณ) — โยน ApiError ถ้าไม่อนุญาต */
export function assertTransition(from: JobStatus, to: JobStatus, role: Role): void {
  if (canTransition(from, to, role)) return;
  const roleMayReach = JOB_TRANSITIONS.some((r) => r.to === to && r.roles.includes(role));
  if (!roleMayReach) throw new ApiError("คุณไม่มีสิทธิ์เปลี่ยนสถานะใบงานเป็นขั้นนี้", 403);
  throw new ApiError(`ใบงานอยู่ในสถานะ ${from} ไม่สามารถเปลี่ยนเป็น ${to} ได้`, 422);
}

/**
 * เปลี่ยนสถานะใบงานแบบมีเงื่อนไขใน transaction (atomic compare-and-set)
 * ถ้าสถานะในฐานข้อมูลเปลี่ยนไปแล้ว (กดซ้ำ / อีกแท็บทำไปก่อน) จะโยน ApiError 409
 */
export async function transitionJob(
  tx: Prisma.TransactionClient,
  params: {
    jobId: string;
    to: JobStatus;
    role: Role;
    data?: Omit<Prisma.JobUpdateManyMutationInput, "status">;
    conflictMessage?: string;
  }
): Promise<void> {
  const { jobId, to, role, data, conflictMessage } = params;
  const from = allowedFrom(to, role);
  if (from.length === 0) throw new ApiError("คุณไม่มีสิทธิ์เปลี่ยนสถานะใบงานเป็นขั้นนี้", 403);

  const moved = await tx.job.updateMany({
    where: { id: jobId, status: { in: from } },
    data: { ...data, status: to },
  });
  if (moved.count === 0) {
    throw new ApiError(conflictMessage ?? "สถานะใบงานเปลี่ยนไปแล้ว กรุณาโหลดหน้าใหม่", 409);
  }
}
