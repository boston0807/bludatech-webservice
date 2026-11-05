// src/lib/expenses.ts
import type { JobStatus } from "@prisma/client";

// แก้รายการประเมินค่าใช้จ่ายได้เฉพาะก่อนออกใบเสนอราคา (หรือหลังลูกค้าขอแก้ไข)
// หลังจากนั้นยอดในใบเสนอราคา/ใบแจ้งหนี้อ้างอิงรายการนี้ ถ้าแก้ได้ยอดจะไม่ตรงกัน
export const EXPENSE_EDITABLE_STATUSES: JobStatus[] = ["PENDING", "PASS_SURVEY", "REQUEST_EDIT"];

export const EXPENSE_LOCKED_MESSAGE =
  "ออกใบเสนอราคาแล้ว ไม่สามารถแก้ไขรายการค่าใช้จ่ายได้ (ลูกค้าต้องขอแก้ไขใบเสนอราคาก่อน)";

/** แปลง expenseId จาก URL เป็นตัวเลข คืน null ถ้าไม่ใช่จำนวนเต็มบวก */
export function parseExpenseId(raw: string): number | null {
  return /^\d+$/.test(raw) ? Number(raw) : null;
}
