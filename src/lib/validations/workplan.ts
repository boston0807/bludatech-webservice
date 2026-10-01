// src/lib/validations/workplan.ts
import { z } from "zod";

export const createWorkPlanSchema = z
  .object({
    jobId: z.string().min(1),
    surveyId: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().datetime({ message: "รูปแบบวันที่ไม่ถูกต้อง" }),
    endDate: z.string().datetime({ message: "รูปแบบวันที่ไม่ถูกต้อง" }),
    materials: z
      .array(
        z.object({
          materialId: z.string().min(1),
          quantity: z.number().int().min(1, "จำนวนต้องมากกว่า 0"),
        })
      )
      .optional(),
  })
  .refine((data) => new Date(data.startDate) < new Date(data.endDate), {
    message: "วันที่เริ่มต้องน้อยกว่าวันที่สิ้นสุด",
    path: ["endDate"],
  });

export type CreateWorkPlanInput = z.infer<typeof createWorkPlanSchema>;
