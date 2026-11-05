// src/lib/materials.ts
// คำนวณยอดวัสดุ: ใช้ไปแล้ว / จองไว้ในแผนงาน / ขาดเท่าไร (UC10, UC11, รายงานที่ 3)

import type { JobStatus, Prisma, PrismaClient, StockMovementReason } from "@prisma/client";
import { NOT_ELEVATOR } from "@/lib/elevator-catalog";

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
    where: NOT_ELEVATOR, // แถวข้อมูลลิฟต์ไม่ใช่สินค้าในคลัง
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

export const LOW_STOCK_THRESHOLD = 5;

// ─── ประวัติสต็อก ───────────────────────────────────────────
// ทุกการเปลี่ยน stockQuantity ต้องผ่านฟังก์ชันนี้ เพื่อให้ยอดคงเหลือกับประวัติตรงกันเสมอ
// ต้องเรียกภายใน transaction เดียวกับงานที่เป็นเหตุ (เช่น เริ่มงาน) เพื่อ rollback พร้อมกันได้

export type StockChangeInput = {
  materialId: string;
  change: number; // + รับเข้า, - เบิกใช้ (ห้ามเป็น 0)
  reason: StockMovementReason;
  jobId?: string | null;
  employeeId?: string | null;
  note?: string | null;
};

export class InsufficientStockError extends Error {
  constructor(public materialId: string, public available: number, public requested: number) {
    super(`สต็อกไม่พอ (คงเหลือ ${available} ต้องใช้ ${requested})`);
  }
}

export async function changeStock(tx: Prisma.TransactionClient, input: StockChangeInput) {
  const { materialId, change, reason } = input;
  if (!Number.isInteger(change) || change === 0) {
    throw new Error(`changeStock: change ต้องเป็นจำนวนเต็มที่ไม่ใช่ 0 (ได้ ${change})`);
  }

  // ตัดสต็อกแบบมีเงื่อนไข กันยอดติดลบเมื่อมีคำขอพร้อมกัน
  const updated = await tx.material.updateMany({
    where: { id: materialId, ...(change < 0 ? { stockQuantity: { gte: -change } } : {}) },
    data: { stockQuantity: { increment: change } },
  });
  if (updated.count === 0) {
    const current = await tx.material.findUnique({ where: { id: materialId }, select: { stockQuantity: true } });
    if (!current) throw new Error(`changeStock: ไม่พบวัสดุ ${materialId}`);
    throw new InsufficientStockError(materialId, current.stockQuantity, -change);
  }

  const material = await tx.material.findUniqueOrThrow({ where: { id: materialId } });
  const movement = await tx.stockMovement.create({
    data: {
      materialId,
      change,
      balanceAfter: material.stockQuantity,
      reason,
      jobId: input.jobId ?? null,
      employeeId: input.employeeId ?? null,
      note: input.note?.trim() || null,
    },
  });
  return { material, movement };
}
