// src/lib/service-rounds.ts
// สร้างใบงานรอบบำรุงประจำเดือนจากสัญญาบำรุง (BP ข้อ 19)
// ใช้ร่วมกันระหว่างปุ่มของธุรการ (POST /api/service-rounds/:jobId) และ Cron รายวัน (POST /api/cron/service-rounds)

import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { addMonths, daysUntil, formatThaiDate } from "@/lib/dates";
import { SERVICE_AUTO_CREATE_DAYS, SERVICE_INTERVAL_MONTHS, SERVICE_REMINDER_DAYS } from "@/lib/service-history";
import { sendServiceRoundEmail } from "@/lib/email";
import { Notify } from "@/lib/notifications";

export { SERVICE_AUTO_CREATE_DAYS };

/** สัญญาบำรุงที่ถึงเวลาสร้างรอบถัดไป (ภายใน `withinDays` วัน รวมที่เลยกำหนดแล้ว) */
export async function findDueContracts(withinDays: number, now = new Date()) {
  const horizon = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000);
  return prisma.job.findMany({
    where: {
      jobType: "SERVICE",
      parentJobId: null,
      status: "COMPLETED",
      service: { nextServiceDate: { not: null, lte: horizon } },
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function createServiceRound(contractJobId: string, opts: { automatic: boolean }) {
  const contract = await prisma.job.findUnique({
    where: { id: contractJobId },
    include: { service: true, customer: true, _count: { select: { serviceRounds: true } } },
  });

  if (!contract || contract.jobType !== "SERVICE" || contract.parentJobId) {
    throw new ApiError("ไม่พบสัญญาบำรุงรักษา", 404);
  }
  if (contract.status !== "COMPLETED" || !contract.service) {
    throw new ApiError("สัญญาบำรุงนี้ยังไม่ปิดงานครั้งแรก", 422);
  }
  const due = contract.service.nextServiceDate;
  if (!due) throw new ApiError("สัญญาบำรุงนี้สิ้นสุดแล้ว ไม่มีรอบบำรุงถัดไป", 422);

  const window = opts.automatic ? SERVICE_AUTO_CREATE_DAYS : SERVICE_REMINDER_DAYS;
  if (daysUntil(due) > window) {
    throw new ApiError(
      `ยังไม่ถึงกำหนด (รอบถัดไป ${formatThaiDate(due)}) สร้างใบงานได้ล่วงหน้าไม่เกิน ${window} วัน`,
      422
    );
  }

  const roundNumber = contract._count.serviceRounds + 1;
  const service = contract.service;

  const roundJob = await prisma.$transaction(async (tx) => {
    // เลื่อนรอบถัดไปแบบมีเงื่อนไข กันสร้างซ้ำ (ธุรการกดพร้อม Cron หรือ Cron ยิงซ้ำ)
    const following = addMonths(due, SERVICE_INTERVAL_MONTHS);
    const end = service.endServiceDate;
    const moved = await tx.jobService.updateMany({
      where: { jobId: contractJobId, nextServiceDate: due },
      data: { nextServiceDate: end && following > end ? null : following },
    });
    if (moved.count === 0) throw new ApiError("รอบบำรุงนี้ถูกสร้างไปแล้ว กรุณาโหลดหน้าใหม่", 409);

    return tx.job.create({
      data: {
        customerId: contract.customerId,
        jobType: "SERVICE",
        jobAddress: contract.jobAddress,
        jobNote: `รอบบำรุงรักษาประจำเดือน ครั้งที่ ${roundNumber} ตามสัญญาใบงาน #${contract.id.slice(-8)} (กำหนด ${formatThaiDate(due)})${opts.automatic ? " — สร้างอัตโนมัติ" : ""}`,
        status: "PENDING",
        parentJobId: contract.id,
        service: {
          create: {
            elevatorModel: service.elevatorModel,
            quantity: service.quantity,
            endServiceDate: service.endServiceDate,
          },
        },
      },
      include: { service: true },
    });
  });

  await Notify.serviceRoundCreated({
    jobId: roundJob.id,
    customerId: contract.customerId,
    customerName: contract.customer.customerName,
    roundNumber,
    dueDateLabel: formatThaiDate(due),
    automatic: opts.automatic,
  });

  if (contract.customer.customerEmail) {
    await sendServiceRoundEmail({
      to: contract.customer.customerEmail,
      customerName: contract.customer.customerName,
      jobId: roundJob.id,
      roundNumber,
      dueDate: due,
      jobAddress: contract.jobAddress,
    });
  }

  return { roundJob, roundNumber, dueDate: due };
}
