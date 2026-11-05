import { Prisma } from "@prisma/client";
import { addMonths } from "@/lib/dates";
import { transitionJob } from "@/lib/job-status";

type HistoryDetails = { summary?: string | null; technicianNames?: string | null };

// สัญญาบำรุงรักษา: อายุสัญญา 2 ปี และเข้าบำรุงทุก 1 เดือน (BP ข้อ 19)
export const SERVICE_CONTRACT_YEARS = 2;
export const SERVICE_INTERVAL_MONTHS = 1;
// แจ้งเตือนล่วงหน้ากี่วัน และธุรการสร้างใบงานรอบถัดไปได้เมื่อเหลือไม่เกินกี่วัน
export const SERVICE_REMINDER_DAYS = 14;
// Cron สร้างใบงานรอบบำรุงอัตโนมัติเมื่อเหลือไม่เกินกี่วัน (ดู src/lib/service-rounds.ts)
export const SERVICE_AUTO_CREATE_DAYS = 7;

export async function saveJobHistory(
  tx: Prisma.TransactionClient,
  jobId: string,
  details: HistoryDetails = {}
) {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: {
      quotation: true,
      service: true,
      workPlan: { include: { technicians: { include: { employee: { select: { employeeName: true } } } } } },
    },
  });

  if (!job) throw new Error("ไม่พบใบงาน");

  // เปลี่ยนสถานะแบบมีเงื่อนไขก่อน กันการบันทึกประวัติซ้ำเมื่อมีคำขอพร้อมกัน
  await transitionJob(tx, {
    jobId,
    to: "COMPLETED",
    role: "ADMIN", // UC17 ธุรการเท่านั้น (route ตรวจ role แล้ว)
    conflictMessage: "ใบงานนี้ไม่อยู่ในสถานะที่บันทึกประวัติได้",
  });

  const completedDate = new Date();
  // ถ้าธุรการไม่กรอกชื่อช่าง ใช้รายชื่อช่างที่ได้รับมอบหมายในแผนงาน
  const assignedNames = job.workPlan?.technicians.map((t) => t.employee.employeeName).join(", ");

  const history = await tx.serviceHistory.create({
    data: {
      jobId,
      customerId: job.customerId,
      jobType: job.jobType,
      completedDate,
      totalCost: job.quotation?.totalAmount || job.jobWage,
      technicianNames: details.technicianNames?.trim() || assignedNames || "ทีมช่างผู้ปฏิบัติงาน",
      summary: details.summary?.trim() || job.jobNote || "บริการเสร็จสิ้นสมบูรณ์",
    },
  });

  if (job.jobType === "SERVICE" && job.service) {
    if (!job.parentJobId) {
      // ใบงานแรกของสัญญาบำรุง → เริ่มนับอายุสัญญา และตั้งรอบบำรุงครั้งถัดไป
      const endServiceDate = addMonths(completedDate, SERVICE_CONTRACT_YEARS * 12);
      await tx.jobService.update({
        where: { jobId },
        data: { endServiceDate, nextServiceDate: addMonths(completedDate, SERVICE_INTERVAL_MONTHS) },
      });
    }
    // ใบงานรอบบำรุง (มี parentJobId) ไม่ต่ออายุสัญญา — รอบถัดไปถูกเลื่อนไปแล้วตอนสร้างใบงานรอบนี้
  }

  return history;
}
