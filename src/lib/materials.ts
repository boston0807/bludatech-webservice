// src/lib/materials.ts
// คำนวณยอดวัสดุ: ใช้ไปแล้ว / จองไว้ในแผนงาน / ขาดเท่าไร (UC10, UC11, รายงานที่ 3)

import type { JobStatus, Prisma, PrismaClient } from "@prisma/client";

type Db = PrismaClient | Prisma.TransactionClient;

// แผนงานที่ยังไม่เริ่มงาน → วัสดุถูก "จอง" แต่ยังไม่ตัดสต็อก
export const RESERVED_JOB_STATUSES: JobStatus[] = ["APPROVE", "PLAN_APPROVED"];
// งานที่เริ่มแล้ว → วัสดุถูกตัดสต็อก (เบิกใช้) ไปแล้วตอน UC12
export const USED_JOB_STATUSES: JobStatus[] = ["IN_PROGRESS", "WAITING_ACCEPTANCE", "ACCEPTED", "PAID", "COMPLETED"];

export type MaterialDemand = {
  jobId: string;
  planId: string;
  customerName: string;
  jobAddress: string;
  jobStatus: JobStatus;
  planStatus: string;
  startDate: Date;
  quantity: number;
};

export type MaterialUsage = {
  id: string;
  materialName: string;
  price: number;
  stockQuantity: number;
  usedQty: number;
  reservedQty: number;
  shortageQty: number; // จำนวนที่ต้องสั่งซื้อเพิ่มให้พอกับแผนงานที่จองไว้
  stockValue: number;
  reservedBy: MaterialDemand[];
};

export async function getMaterialUsage(db: Db): Promise<MaterialUsage[]> {
  const materials = await db.material.findMany({
    orderBy: { materialName: "asc" },
    include: {
      workPlanMaterials: {
        include: {
          workPlan: {
            select: {
              id: true,
              status: true,
              startDate: true,
              job: { select: { id: true, status: true, jobAddress: true, customer: { select: { customerName: true } } } },
            },
          },
        },
      },
    },
  });

  return materials.map((m) => {
    let usedQty = 0;
    const reservedBy: MaterialDemand[] = [];

    for (const wm of m.workPlanMaterials) {
      const plan = wm.workPlan;
      if (USED_JOB_STATUSES.includes(plan.job.status)) usedQty += wm.quantity;
      // แผนที่ลูกค้าไม่อนุมัติ ไม่ถือว่าจอง จนกว่าหัวหน้าช่างจะแก้แล้วส่งใหม่
      if (RESERVED_JOB_STATUSES.includes(plan.job.status) && plan.status !== "REJECTED") {
        reservedBy.push({
          jobId: plan.job.id,
          planId: plan.id,
          customerName: plan.job.customer.customerName,
          jobAddress: plan.job.jobAddress,
          jobStatus: plan.job.status,
          planStatus: plan.status,
          startDate: plan.startDate,
          quantity: wm.quantity,
        });
      }
    }

    reservedBy.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    const reservedQty = reservedBy.reduce((sum, r) => sum + r.quantity, 0);
    const price = Number(m.price);

    return {
      id: m.id,
      materialName: m.materialName,
      price,
      stockQuantity: m.stockQuantity,
      usedQty,
      reservedQty,
      shortageQty: Math.max(0, reservedQty - m.stockQuantity),
      stockValue: m.stockQuantity * price,
      reservedBy,
    };
  });
}

// เกณฑ์ "ใกล้หมด" ตั้งได้ผ่าน env LOW_STOCK_THRESHOLD (ไม่ต้องเพิ่ม field ในตาราง Material)
// อ่านตอนเรียกใช้ เพราะบน Cloudflare Workers env ถูกใส่ตอนรับ request
export function getLowStockThreshold(): number {
  const n = Number(process.env.LOW_STOCK_THRESHOLD ?? 5);
  return Number.isInteger(n) && n >= 0 ? n : 5;
}
