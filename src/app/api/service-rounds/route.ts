// src/app/api/service-rounds/route.ts
// BP ข้อ 19 — รอบบำรุงรักษาประจำเดือนของสัญญาบำรุง (ใบงาน SERVICE ที่ปิดงานแล้ว)
// ADMIN เห็นทุกสัญญา, CUSTOMER เห็นเฉพาะสัญญาของตัวเอง
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import { successResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { daysUntil } from "@/lib/dates";
import { SERVICE_REMINDER_DAYS } from "@/lib/service-history";

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN" && auth.role !== "CUSTOMER") return forbiddenResponse();

  const contracts = await prisma.job.findMany({
    where: {
      jobType: "SERVICE",
      parentJobId: null,
      status: "COMPLETED",
      ...(auth.role === "CUSTOMER" ? { customerId: auth.sub } : {}),
      service: { isNot: null },
    },
    include: {
      customer: { select: { customerName: true, customerPhone: true, customerEmail: true } },
      service: true,
      serviceRounds: {
        select: { id: true, status: true, createdAt: true, jobNote: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  const now = new Date();
  const items = contracts
    .map((c) => {
      const next = c.service?.nextServiceDate ?? null;
      const end = c.service?.endServiceDate ?? null;
      const dueIn = next ? daysUntil(next, now) : null;
      const openRound = c.serviceRounds.find((r) => r.status !== "COMPLETED" && r.status !== "CANCELLED") ?? null;
      return {
        contractJobId: c.id,
        customerId: c.customerId,
        customer: c.customer,
        jobAddress: c.jobAddress,
        elevatorModel: c.service?.elevatorModel ?? null,
        quantity: c.service?.quantity ?? 1,
        nextServiceDate: next,
        endServiceDate: end,
        dueInDays: dueIn,
        dueStatus:
          !next ? "ENDED" : dueIn! < 0 ? "OVERDUE" : dueIn! <= SERVICE_REMINDER_DAYS ? "DUE_SOON" : "SCHEDULED",
        roundsCreated: c.serviceRounds.length,
        nextRoundNumber: c.serviceRounds.length + 1,
        openRound,
        canCreateRound: !!next && dueIn! <= SERVICE_REMINDER_DAYS,
      };
    })
    .sort((a, b) => (a.dueInDays ?? 99999) - (b.dueInDays ?? 99999));

  return successResponse(items);
}
