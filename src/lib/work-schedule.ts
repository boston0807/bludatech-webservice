// src/lib/work-schedule.ts
// ตรวจตารางงานช่างชนกัน (แก้ปัญหา BP ข้อ 3: หัวหน้าช่างจัดงานซ้อนวันเดียวกัน / ช่างลืมนัด)

import type { Prisma, PrismaClient, JobStatus } from "@prisma/client";
import { dayRangesOverlap, formatThaiDate } from "@/lib/dates";

type Db = PrismaClient | Prisma.TransactionClient;

// แผนงานที่ยังกินเวลาช่างอยู่ (ยังไม่เสร็จ ไม่ถูกยกเลิก)
export const ACTIVE_PLAN_JOB_STATUSES: JobStatus[] = ["APPROVE", "PLAN_APPROVED", "IN_PROGRESS"];

export type ScheduleConflict = {
  employeeId: string;
  employeeName: string;
  planId: string;
  jobId: string;
  jobAddress: string;
  startDate: Date;
  endDate: Date;
};

export async function findScheduleConflicts(
  db: Db,
  params: { technicianIds: string[]; startDate: Date; endDate: Date; excludePlanId?: string }
): Promise<ScheduleConflict[]> {
  const { technicianIds, startDate, endDate, excludePlanId } = params;
  if (technicianIds.length === 0) return [];

  const assignments = await db.workPlanTechnician.findMany({
    where: {
      employeeId: { in: technicianIds },
      workPlan: {
        ...(excludePlanId ? { id: { not: excludePlanId } } : {}),
        status: { not: "REJECTED" },
        job: { status: { in: ACTIVE_PLAN_JOB_STATUSES } },
      },
    },
    include: {
      employee: { select: { employeeName: true } },
      workPlan: { select: { id: true, jobId: true, startDate: true, endDate: true, job: { select: { jobAddress: true } } } },
    },
  });

  return assignments
    .filter((a) => dayRangesOverlap(startDate, endDate, a.workPlan.startDate, a.workPlan.endDate))
    .map((a) => ({
      employeeId: a.employeeId,
      employeeName: a.employee.employeeName,
      planId: a.workPlan.id,
      jobId: a.workPlan.jobId,
      jobAddress: a.workPlan.job.jobAddress,
      startDate: a.workPlan.startDate,
      endDate: a.workPlan.endDate,
    }));
}

export function describeConflicts(conflicts: ScheduleConflict[]): string {
  const lines = conflicts.map(
    (c) =>
      `${c.employeeName} มีงานที่ "${c.jobAddress}" วันที่ ${formatThaiDate(c.startDate)} – ${formatThaiDate(c.endDate)}`
  );
  return `ตารางงานช่างชนกัน: ${lines.join("; ")}`;
}

/**
 * ช่างทั่วไปเริ่มงาน/บันทึกผลได้เฉพาะงานที่ตนได้รับมอบหมาย
 * หัวหน้าช่างและแอดมินทำแทนได้ทุกงาน, แผนเก่าที่ยังไม่มีการมอบหมาย (ก่อนมีฟีเจอร์นี้) ช่างทุกคนทำได้
 */
export function canWorkOnPlan(
  role: string,
  employeeId: string,
  assignedIds: string[]
): boolean {
  if (role === "HEAD_TECHNICIAN" || role === "ADMIN") return true;
  if (role !== "TECHNICIAN") return false;
  return assignedIds.length === 0 || assignedIds.includes(employeeId);
}
