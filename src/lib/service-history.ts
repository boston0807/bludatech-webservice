import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";

export async function saveJobHistory(tx: Prisma.TransactionClient, jobId: string) {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: { quotation: true },
  });

  if (!job) throw new Error("ไม่พบใบงาน");

  // เปลี่ยนสถานะแบบมีเงื่อนไขก่อน กันการบันทึกประวัติซ้ำเมื่อมีคำขอพร้อมกัน
  const completed = await tx.job.updateMany({
    where: { id: jobId, status: { in: ["ACCEPTED", "PAID"] } },
    data: { status: "COMPLETED" },
  });
  if (completed.count === 0) {
    throw new ApiError("ใบงานนี้ไม่อยู่ในสถานะที่บันทึกประวัติได้", 409);
  }

  const completedDate = new Date();

  const history = await tx.serviceHistory.create({
    data: {
      jobId,
      customerId: job.customerId,
      jobType: job.jobType,
      completedDate,
      totalCost: job.quotation?.totalAmount || job.jobWage,
      technicianNames: "ทีมช่างผู้ปฏิบัติงาน",
      summary: job.jobNote || "บริการเสร็จสิ้นสมบูรณ์",
    },
  });

  if (job.jobType === "SERVICE") {
    const endServiceDate = new Date(completedDate);
    endServiceDate.setFullYear(endServiceDate.getFullYear() + 2);

    await tx.jobService.update({
      where: { jobId },
      data: { endServiceDate },
    });
  }

  return history;
}