// src/lib/validations/workplan.ts
import { z } from "zod";

export const createWorkPlanSchema = z
  .object({
    jobId: z.string().min(1),
    surveyId: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().min(1, "กรุณาระบุวันที่เริ่มต้น"),
    endDate: z.string().optional(),
    materials: z
      .array(
        z.object({
          materialId: z.string().min(1),
          quantity: z.number().int().min(1, "จำนวนต้องมากกว่า 0"),
        })
      )
      .optional(),
  });

export type CreateWorkPlanInput = z.infer<typeof createWorkPlanSchema>;
