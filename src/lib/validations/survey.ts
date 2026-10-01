// src/lib/validations/survey.ts
import { z } from "zod";

export const createSurveySchema = z.object({
  jobId: z.string().min(1),
  note: z.string().optional(),
});

export const createExpenseSchema = z.object({
  expenseName: z.string().min(1, "กรุณากรอกชื่อรายการ"),
  quantity: z
    .number({ invalid_type_error: "กรุณากรอกจำนวน" })
    .int()
    .min(1, "จำนวนต้องมากกว่า 0"),
  price: z
    .number({ invalid_type_error: "กรุณากรอกราคา" })
    .min(0, "ราคาต้องไม่ติดลบ"),
});

export const createExpensesSchema = z.object({
  jobId: z.string().min(1),
  expenses: z.array(createExpenseSchema).min(1, "กรุณากรอกรายการค่าใช้จ่ายอย่างน้อย 1 รายการ"),
});

export type CreateSurveyInput = z.infer<typeof createSurveySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type CreateExpensesInput = z.infer<typeof createExpensesSchema>;
