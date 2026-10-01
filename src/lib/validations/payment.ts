// src/lib/validations/payment.ts
import { z } from "zod";

export const createPaymentSchema = z.object({
  receiptId: z.string().min(1),
  amount: z
    .number({ invalid_type_error: "กรุณากรอกจำนวนเงิน" })
    .min(0.01, "จำนวนเงินต้องมากกว่า 0"),
  paymentMethod: z.enum(["TRANSFER", "CASH", "CREDIT_CARD"], {
    errorMap: () => ({ message: "กรุณาเลือกวิธีชำระเงิน" }),
  }),
  slipUrl: z.string().url("URL สลิปไม่ถูกต้อง").optional().or(z.literal("")),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
