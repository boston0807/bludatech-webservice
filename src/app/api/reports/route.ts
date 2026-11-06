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
import { parseDateRange as parseRange } from "@/lib/list-filters";

const JOB_TYPES: JobType[] = ["INSTALLATION", "REPAIR", "SERVICE"];

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

  if (type === "kpi") {
    return successResponse(await buildKpi(range));
  }

  return errorResponse("type ต้องเป็น jobs-summary, service-history, materials หรือ kpi", 422);
}

// ─── KPI (รายงานเสริม) ───────────────────────────────────────────────────────
// คำนวณจากวันที่ที่มีอยู่แล้วในแต่ละตาราง ไม่ต้องเพิ่ม field
//   หมายเหตุ: ไม่มีตารางเก็บประวัติสถานะ จึงใช้ updatedAt ของใบเสนอราคา/แผนงานที่อนุมัติแล้ว
//   เป็นเวลาที่อนุมัติโดยประมาณ (หลังอนุมัติแล้วเอกสารทั้งสองจะไม่ถูกแก้ไขอีก)

const DAY_MS = 24 * 60 * 60 * 1000;

function avgDays(pairs: Array<[Date | null | undefined, Date | null | undefined]>) {
  const diffs = pairs
    .filter((p): p is [Date, Date] => !!p[0] && !!p[1] && p[1].getTime() >= p[0].getTime())
    .map(([a, b]) => (b.getTime() - a.getTime()) / DAY_MS);
  return {
    avgDays: diffs.length ? round2(diffs.reduce((s, d) => s + d, 0) / diffs.length) : null,
    sample: diffs.length,
  };
}

async function buildKpi(range: { from: Date; to: Date }) {
  const jobs = await prisma.job.findMany({
    where: { requestDate: { gte: range.from, lte: range.to } },
    select: {
      id: true,
      jobType: true,
      status: true,
      requestDate: true,
      surveys: { select: { surveyDate: true }, orderBy: { surveyDate: "asc" }, take: 1 },
      quotation: { select: { status: true, createdAt: true, updatedAt: true } },
      workPlan: { select: { status: true, createdAt: true, updatedAt: true, startDate: true } },
      receipt: {
        select: {
          createdAt: true,
          status: true,
          payments: { select: { paymentDate: true }, orderBy: { paymentDate: "asc" }, take: 1 },
        },
      },
    },
  });

  const PLAN_APPROVED = ["APPROVED", "IN_PROGRESS", "FINISHED"];

  const stages = [
    {
      key: "request_to_survey",
      label: "ยื่นคำขอ → สำรวจหน้างาน",
      ...avgDays(jobs.map((j) => [j.requestDate, j.surveys[0]?.surveyDate])),
    },
    {
      key: "survey_to_quotation",
      label: "สำรวจ → ออกใบเสนอราคา",
      ...avgDays(jobs.map((j) => [j.surveys[0]?.surveyDate, j.quotation?.createdAt])),
    },
    {
      key: "quotation_to_approval",
      label: "ออกใบเสนอราคา → ลูกค้าอนุมัติ",
      ...avgDays(
        jobs.map((j) => [j.quotation?.createdAt, j.quotation?.status === "APPROVED" ? j.quotation.updatedAt : null])
      ),
    },
    {
      key: "plan_to_approval",
      label: "จัดทำแผนงาน → ลูกค้าอนุมัติแผน",
      ...avgDays(
        jobs.map((j) => [
          j.workPlan?.createdAt,
          j.workPlan && PLAN_APPROVED.includes(j.workPlan.status) ? j.workPlan.updatedAt : null,
        ])
      ),
    },
    {
      key: "invoice_to_payment",
      label: "ออกใบแจ้งหนี้ → ชำระเงิน",
      ...avgDays(jobs.map((j) => [j.receipt?.createdAt, j.receipt?.payments[0]?.paymentDate])),
    },
    {
      key: "request_to_payment",
      label: "รวมทั้งกระบวนการ (ยื่นคำขอ → ชำระเงิน)",
      ...avgDays(jobs.map((j) => [j.requestDate, j.receipt?.payments[0]?.paymentDate])),
    },
  ];

  // รายได้ที่รับชำระจริงในช่วงที่เลือก แยกตามประเภทงาน (ตามวันที่ชำระ)
  const payments = await prisma.payment.findMany({
    where: { paymentDate: { gte: range.from, lte: range.to } },
    select: { amount: true, receipt: { select: { job: { select: { jobType: true } } } } },
  });
  const revenueByType = JOB_TYPES.map((jobType) => {
    const rows = payments.filter((p) => p.receipt.job.jobType === jobType);
    return { jobType, payments: rows.length, amount: round2(rows.reduce((s, p) => s + Number(p.amount), 0)) };
  });

  return {
    jobCount: jobs.length,
    stages,
    revenueByType,
    revenueTotal: round2(revenueByType.reduce((s, r) => s + r.amount, 0)),
  };
}
