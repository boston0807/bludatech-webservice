// src/app/api/technicians/route.ts
// รายชื่อช่าง/หัวหน้าช่าง สำหรับมอบหมายในแผนงาน
// ?from=ISO&to=ISO → บอกด้วยว่าช่างแต่ละคนว่างในช่วงนั้นหรือไม่ (ใช้แสดงในฟอร์มทำแผนงาน)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import { successResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { ACTIVE_PLAN_JOB_STATUSES } from "@/lib/work-schedule";
import { dayRangesOverlap } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN", "TECHNICIAN", "HEAD_TECHNICIAN")) return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const excludeJobId = searchParams.get("excludeJobId");
  const rangeStart = from && !Number.isNaN(Date.parse(from)) ? new Date(from) : null;
  const rangeEnd = to && !Number.isNaN(Date.parse(to)) ? new Date(to) : rangeStart;

  const technicians = await prisma.employee.findMany({
    where: { role: { in: ["TECHNICIAN", "HEAD_TECHNICIAN"] } },
    orderBy: [{ role: "asc" }, { employeeName: "asc" }],
    select: {
      id: true,
      employeeName: true,
      role: true,
      planAssignments: {
        where: {
          workPlan: {
            status: { not: "REJECTED" },
            job: { status: { in: ACTIVE_PLAN_JOB_STATUSES }, ...(excludeJobId ? { id: { not: excludeJobId } } : {}) },
          },
        },
        select: {
          workPlan: { select: { jobId: true, startDate: true, endDate: true, job: { select: { jobAddress: true } } } },
        },
      },
    },
  });

  return successResponse(
    technicians.map((t) => {
      const plans = t.planAssignments.map((a) => ({
        jobId: a.workPlan.jobId,
        jobAddress: a.workPlan.job.jobAddress,
        startDate: a.workPlan.startDate,
        endDate: a.workPlan.endDate,
      }));
      const conflicts =
        rangeStart && rangeEnd ? plans.filter((p) => dayRangesOverlap(rangeStart, rangeEnd, p.startDate, p.endDate)) : [];
      return {
        id: t.id,
        employeeName: t.employeeName,
        role: t.role,
        activePlans: plans.length,
        available: conflicts.length === 0,
        conflicts,
      };
    })
  );
}
