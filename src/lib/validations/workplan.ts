// src/lib/validations/workplan.ts
import { z } from "zod";

export const createWorkPlanSchema = z
  .object({
    jobId: z.string().min(1),
    surveyId: z.string().optional(),
    location: z.string().optional(),
    startDate: z.string().min(1, "กรุณาระบุวันที่เริ่มต้น"),
    endDate: z.string().optional(),
    // ช่างผู้ปฏิบัติงาน — ใช้ตรวจตารางงานชนกันและให้ช่างเห็นงานของตัวเอง
    technicianIds: z
      .array(z.string().min(1))
      .min(1, "กรุณาเลือกช่างผู้ปฏิบัติงานอย่างน้อย 1 คน")
      .max(20),
    materials: z
      .array(
        z.object({
          materialId: z.string().min(1),
          quantity: z.number().int().min(1, "จำนวนต้องมากกว่า 0"),
        })
      )
      .optional(),
  })
  .refine((d) => !Number.isNaN(Date.parse(d.startDate)), {
    message: "วันที่เริ่มต้นไม่ถูกต้อง",
    path: ["startDate"],
  })
  .refine((d) => !d.endDate || !Number.isNaN(Date.parse(d.endDate)), {
    message: "วันที่สิ้นสุดไม่ถูกต้อง",
    path: ["endDate"],
  })
  .refine((d) => !d.endDate || Date.parse(d.endDate) >= Date.parse(d.startDate), {
    message: "วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่มต้น",
    path: ["endDate"],
  })
  .refine(
    (d) => !d.materials || new Set(d.materials.map((m) => m.materialId)).size === d.materials.length,
    { message: "เลือกอะไหล่ซ้ำกัน กรุณารวมเป็นรายการเดียว", path: ["materials"] }
  );

export type CreateWorkPlanInput = z.infer<typeof createWorkPlanSchema>;
