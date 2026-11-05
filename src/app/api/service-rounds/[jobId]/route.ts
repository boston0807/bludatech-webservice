// src/app/api/service-rounds/[jobId]/route.ts
// POST — ธุรการสร้างใบงานรอบบำรุงประจำเดือนจากสัญญาบำรุง แล้วเลื่อนกำหนดรอบถัดไปอีก 1 เดือน
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import {
  ApiError,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { addMonths, daysUntil, formatThaiDate } from "@/lib/dates";
import { SERVICE_INTERVAL_MONTHS, SERVICE_REMINDER_DAYS } from "@/lib/service-history";
import { sendServiceRoundEmail } from "@/lib/email";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse("เฉพาะธุรการที่สร้างใบงานรอบบำรุงได้");

  const { jobId } = await params;
  const contract = await prisma.job.findUnique({
    where: { id: jobId },
    include: { service: true, customer: true, _count: { select: { serviceRounds: true } } },
  });

  if (!contract || contract.jobType !== "SERVICE" || contract.parentJobId) {
    return notFoundResponse("ไม่พบสัญญาบำรุงรักษา");
  }
  if (contract.status !== "COMPLETED" || !contract.service) {
    return errorResponse("สัญญาบำรุงนี้ยังไม่ปิดงานครั้งแรก", 422);
  }
  const due = contract.service.nextServiceDate;
  if (!due) return errorResponse("สัญญาบำรุงนี้สิ้นสุดแล้ว ไม่มีรอบบำรุงถัดไป", 422);
  if (daysUntil(due) > SERVICE_REMINDER_DAYS) {
    return errorResponse(
      `ยังไม่ถึงกำหนด (รอบถัดไป ${formatThaiDate(due)}) สร้างใบงานได้ล่วงหน้าไม่เกิน ${SERVICE_REMINDER_DAYS} วัน`,
      422
    );
  }

  const roundNumber = contract._count.serviceRounds + 1;

  try {
    const roundJob = await prisma.$transaction(async (tx) => {
      // เลื่อนรอบถัดไปแบบมีเงื่อนไข กันกดสร้างซ้ำพร้อมกัน
      const following = addMonths(due, SERVICE_INTERVAL_MONTHS);
      const end = contract.service!.endServiceDate;
      const moved = await tx.jobService.updateMany({
        where: { jobId, nextServiceDate: due },
        data: { nextServiceDate: end && following > end ? null : following },
      });
      if (moved.count === 0) throw new ApiError("รอบบำรุงนี้ถูกสร้างไปแล้ว กรุณาโหลดหน้าใหม่", 409);

      return tx.job.create({
        data: {
          customerId: contract.customerId,
          jobType: "SERVICE",
          jobAddress: contract.jobAddress,
          jobNote: `รอบบำรุงรักษาประจำเดือน ครั้งที่ ${roundNumber} ตามสัญญาใบงาน #${contract.id.slice(-8)} (กำหนด ${formatThaiDate(due)})`,
          status: "PENDING",
          parentJobId: contract.id,
          service: {
            create: {
              elevatorModel: contract.service!.elevatorModel,
              quantity: contract.service!.quantity,
              endServiceDate: contract.service!.endServiceDate,
            },
          },
        },
        include: { service: true },
      });
    });

    if (contract.customer.customerEmail) {
      sendServiceRoundEmail({
        to: contract.customer.customerEmail,
        customerName: contract.customer.customerName,
        jobId: roundJob.id,
        roundNumber,
        dueDate: due,
        jobAddress: contract.jobAddress,
      });
    }

    return successResponse(roundJob, `สร้างใบงานรอบบำรุงครั้งที่ ${roundNumber} และแจ้งลูกค้าแล้ว`);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[CREATE_SERVICE_ROUND_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการสร้างใบงานรอบบำรุง", 500);
  }
}
