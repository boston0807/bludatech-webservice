// src/lib/validations/payment.ts
import { z } from "zod";

export function isHttpUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export const createPaymentSchema = z.object({
  receiptId: z.string().min(1),
  amount: z
    .number({ invalid_type_error: "กรุณากรอกจำนวนเงิน" })
    .min(0.01, "จำนวนเงินต้องมากกว่า 0"),
  paymentMethod: z.enum(["TRANSFER", "CASH", "CREDIT_CARD"], {
    errorMap: () => ({ message: "กรุณาเลือกวิธีชำระเงิน" }),
  }),
  // รับเฉพาะลิงก์ http/https เท่านั้น (กัน javascript:/data: URL ที่จะถูกเปิดจากหน้าบัญชี)
  slipUrl: z
    .string()
    .trim()
    .max(500, "ลิงก์สลิปยาวเกินไป")
    .refine((v) => v === "" || isHttpUrl(v), "ลิงก์สลิปต้องขึ้นต้นด้วย http:// หรือ https://")
    .optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
