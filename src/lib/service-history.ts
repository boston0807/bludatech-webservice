import { Prisma } from "@prisma/client";

export async function saveJobHistory(tx: Prisma.TransactionClient, jobId: string) {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    include: { quotation: true },
  });

  if (!job) throw new Error("ไม่พบใบงาน");

  const completedDate = new Date();
  const nextDate = new Date(completedDate);
  nextDate.setMonth(nextDate.getMonth() + 6);

  const history = await tx.serviceHistory.create({
    data: {
      jobId,
      customerId: job.customerId,
      jobType: job.jobType,
      completedDate,
      totalCost: job.quotation?.totalAmount || job.jobWage,
      technicianNames: "ทีมช่างผู้ปฏิบัติงาน",
      summary: job.jobNote || "บริการเสร็จสิ้นสมบูรณ์",
      nextServiceDate: job.jobType === "SERVICE" ? nextDate : null,
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

  await tx.job.update({
    where: { id: jobId },
    data: { status: "COMPLETED" },
  });

  return history;
}