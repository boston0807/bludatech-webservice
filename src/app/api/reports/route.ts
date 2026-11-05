// src/app/api/reports/route.ts
// รายงานตาม Output design (บทที่ 6)
//   ?type=jobs-summary     รายงานที่ 1 สรุปภาพรวมงานบริการแยกตามประเภทงาน (ตาม request_date)
//   ?type=service-history  รายงานที่ 2 ประวัติการให้บริการลูกค้า (ตาม completed_date)
//   ?type=materials        รายงานที่ 3 การใช้วัสดุและสต็อกคงเหลือ (ภาพรวมปัจจุบัน)
//   &from=YYYY-MM-DD&to=YYYY-MM-DD  (เวลาไทย รวมวันสุดท้าย)
import { NextRequest } from "next/server";
import type { JobType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { getMaterialUsage } from "@/lib/materials";

const JOB_TYPES: JobType[] = ["INSTALLATION", "REPAIR", "SERVICE"];

function parseRange(searchParams: URLSearchParams): { from: Date; to: Date } | null {
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!fromStr || !toStr || !re.test(fromStr) || !re.test(toStr)) return null;
  // ขอบเขตวันตามเวลาไทย: 00:00 ของวันแรก ถึง 23:59:59.999 ของวันสุดท้าย
  const from = new Date(`${fromStr}T00:00:00.000+07:00`);
  const to = new Date(`${toStr}T23:59:59.999+07:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  return { from, to };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "materials") {
    if (auth.role !== "ADMIN" && auth.role !== "ACCOUNTANT") return forbiddenResponse();
    const usage = await getMaterialUsage(prisma);
    const rows = usage.map(({ reservedBy: _reservedBy, ...row }) => row);
    return successResponse({
      rows,
      totals: {
        usedQty: rows.reduce((s, r) => s + r.usedQty, 0),
        reservedQty: rows.reduce((s, r) => s + r.reservedQty, 0),
        stockValue: round2(rows.reduce((s, r) => s + r.stockValue, 0)),
        shortageItems: rows.filter((r) => r.shortageQty > 0).length,
      },
    });
  }

  if (auth.role !== "ADMIN") return forbiddenResponse();

  const range = parseRange(searchParams);
  if (!range) return errorResponse("กรุณาระบุช่วงวันที่ from และ to (YYYY-MM-DD) ให้ถูกต้อง", 422);

  if (type === "jobs-summary") {
    const jobs = await prisma.job.findMany({
      where: { requestDate: { gte: range.from, lte: range.to } },
      select: { jobType: true, status: true, id: true },
    });
    const histories = await prisma.serviceHistory.findMany({
      where: { jobId: { in: jobs.map((j) => j.id) } },
      select: { jobId: true, totalCost: true },
    });
    const revenueByJob = new Map(histories.map((h) => [h.jobId, Number(h.totalCost)]));

    const rows = JOB_TYPES.map((jobType) => {
      const ofType = jobs.filter((j) => j.jobType === jobType);
      const completed = ofType.filter((j) => j.status === "COMPLETED");
      const revenues = ofType.map((j) => revenueByJob.get(j.id)).filter((v): v is number => v !== undefined);
      const totalRevenue = revenues.reduce((s, v) => s + v, 0);
      return {
        jobType,
        totalJobs: ofType.length,
        completedJobs: completed.length,
        inProgressJobs: ofType.filter((j) => j.status !== "COMPLETED" && j.status !== "CANCELLED").length,
        cancelledJobs: ofType.filter((j) => j.status === "CANCELLED").length,
        totalRevenue: round2(totalRevenue),
        avgRevenue: revenues.length ? round2(totalRevenue / revenues.length) : 0,
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue);

    const sum = (k: "totalJobs" | "completedJobs" | "inProgressJobs" | "cancelledJobs" | "totalRevenue") =>
      rows.reduce((s, r) => s + r[k], 0);
    return successResponse({
      rows,
      totals: {
        totalJobs: sum("totalJobs"),
        completedJobs: sum("completedJobs"),
        inProgressJobs: sum("inProgressJobs"),
        cancelledJobs: sum("cancelledJobs"),
        totalRevenue: round2(sum("totalRevenue")),
        avgRevenue: histories.length ? round2(sum("totalRevenue") / histories.length) : 0,
      },
    });
  }

  if (type === "service-history") {
    const histories = await prisma.serviceHistory.findMany({
      where: { completedDate: { gte: range.from, lte: range.to } },
      orderBy: { completedDate: "desc" },
    });
    const [customers, services] = await Promise.all([
      prisma.customer.findMany({
        where: { id: { in: [...new Set(histories.map((h) => h.customerId))] } },
        select: { id: true, customerName: true },
      }),
      prisma.jobService.findMany({
        where: { jobId: { in: histories.map((h) => h.jobId) } },
        select: { jobId: true, endServiceDate: true },
      }),
    ]);
    const nameById = new Map(customers.map((c) => [c.id, c.customerName]));
    const endByJob = new Map(services.map((s) => [s.jobId, s.endServiceDate]));

    const rows = histories.map((h) => ({
      historyId: h.id,
      jobId: h.jobId,
      completedDate: h.completedDate,
      customerName: nameById.get(h.customerId) ?? "-",
      jobType: h.jobType,
      technicianNames: h.technicianNames,
      totalCost: Number(h.totalCost),
      endServiceDate: endByJob.get(h.jobId) ?? null,
    }));
    return successResponse({
      rows,
      totals: { count: rows.length, totalCost: round2(rows.reduce((s, r) => s + r.totalCost, 0)) },
    });
  }

  return errorResponse("type ต้องเป็น jobs-summary, service-history หรือ materials", 422);
}
