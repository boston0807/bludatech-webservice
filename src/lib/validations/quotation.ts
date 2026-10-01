// src/lib/validations/quotation.ts
import { z } from "zod";

export const createQuotationSchema = z.object({
  jobId: z.string().min(1),
  totalAmount: z
    .number({ invalid_type_error: "กรุณากรอกจำนวนเงิน" })
    .min(0, "จำนวนเงินต้องไม่ติดลบ"),
});

export const quotationActionSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  rejectNote: z.string().optional(),
}).refine(
  (data) => data.action === "APPROVE" || (data.action === "REJECT" && data.rejectNote && data.rejectNote.length > 0),
  { message: "กรุณาระบุเหตุผลที่ปฏิเสธ", path: ["rejectNote"] }
);

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type QuotationActionInput = z.infer<typeof quotationActionSchema>;
