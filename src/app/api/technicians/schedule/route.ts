// src/app/api/technicians/schedule/route.ts
// ตารางงานช่าง (แก้ปัญหาช่างลืมนัด / งานซ้อน)
//   ช่าง        → เห็นเฉพาะงานที่ตัวเองได้รับมอบหมาย
//   หัวหน้าช่าง/แอดมิน → เห็นของทุกคน (?mine=1 ดูเฉพาะของตัวเอง)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth, hasRole } from "@/lib/api-auth";
import { successResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { bangkokDayKey } from "@/lib/dates";

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (!hasRole(auth, "ADMIN", "TECHNICIAN", "HEAD_TECHNICIAN")) return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const onlyMine = auth.role === "TECHNICIAN" || searchParams.get("mine") === "1";
  const includePast = searchParams.get("past") === "1";
  const todayKey = bangkokDayKey(new Date());

  const plans = await prisma.workPlan.findMany({
    where: {
      status: { not: "REJECTED" },
      job: { status: { in: ["APPROVE", "PLAN_APPROVED", "IN_PROGRESS", "WAITING_ACCEPTANCE"] } },
      ...(onlyMine ? { technicians: { some: { employeeId: auth.sub } } } : {}),
    },
    orderBy: { startDate: "asc" },
    include: {
      technicians: { include: { employee: { select: { id: true, employeeName: true, role: true } } } },
      materials: { include: { material: { select: { materialName: true } } } },
      job: {
        select: {
          id: true,
          jobType: true,
          jobAddress: true,
          status: true,
          reworkNote: true,
          customer: { select: { customerName: true, customerPhone: true } },
        },
      },
    },
  });

  const items = plans
    .map((p) => {
      const startKey = bangkokDayKey(p.startDate);
      const endKey = bangkokDayKey(p.endDate);
      return {
        planId: p.id,
        planStatus: p.status,
        startDate: p.startDate,
        endDate: p.endDate,
        location: p.location ?? p.job.jobAddress,
        job: p.job,
        technicians: p.technicians.map((t) => t.employee),
        materials: p.materials.map((m) => ({ materialName: m.material.materialName, quantity: m.quantity })),
        isToday: startKey <= todayKey && todayKey <= endKey,
        isOverdue: endKey < todayKey && (p.job.status === "PLAN_APPROVED" || p.job.status === "IN_PROGRESS"),
        isPast: endKey < todayKey,
      };
    })
    .filter((i) => includePast || !i.isPast || i.isOverdue || i.job.status === "IN_PROGRESS");

  return successResponse({ onlyMine, today: todayKey, items });
}
