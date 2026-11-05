// src/lib/validations/survey.ts
import { z } from "zod";

export const createExpenseSchema = z.object({
  expenseName: z.string().trim().min(1, "กรุณากรอกชื่อรายการ"),
  quantity: z
    .number({ invalid_type_error: "กรุณากรอกจำนวน" })
    .int()
    .min(1, "จำนวนต้องมากกว่า 0"),
  price: z
    .number({ invalid_type_error: "กรุณากรอกราคา" })
    .min(0, "ราคาต้องไม่ติดลบ"),
});

export const createSurveySchema = z
  .object({
    jobId: z.string().min(1),
    // ONSITE = ลงพื้นที่สำรวจ, REMOTE = ประเมินจากข้อมูลที่ลูกค้าแจ้งโดยไม่ต้องเดินทาง (ลดต้นทุนการสำรวจ)
    method: z.enum(["ONSITE", "REMOTE"]).default("ONSITE"),
    note: z.string().max(2000).optional(),
    // UC05: บันทึกผลสำรวจและรายการอะไหล่ในครั้งเดียว
    expenses: z.array(createExpenseSchema).optional(),
  })
  .refine((d) => d.method === "ONSITE" || (d.note && d.note.trim().length > 0), {
    message: "การประเมินแบบไม่ลงพื้นที่ต้องระบุข้อมูลที่ใช้ประเมิน (เช่น อาการที่ลูกค้าแจ้ง รูปถ่าย ประวัติการซ่อม)",
    path: ["note"],
  });

export const createExpensesSchema = z.object({
  jobId: z.string().min(1),
  expenses: z.array(createExpenseSchema).min(1, "กรุณากรอกรายการค่าใช้จ่ายอย่างน้อย 1 รายการ"),
});

export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpensesInput = z.infer<typeof createExpensesSchema>;
