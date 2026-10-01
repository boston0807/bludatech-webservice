// src/lib/validations/job.ts
import { z } from "zod";

export const jobBaseSchema = z.object({
  jobAddress: z.string().min(1, "กรุณากรอกที่อยู่สถานที่ปฏิบัติงาน"),
  jobNote: z.string().optional(),
});

export const createInstallationJobSchema = jobBaseSchema.extend({
  jobType: z.literal("INSTALLATION"),
  buildingFloor: z
    .number({ invalid_type_error: "กรุณากรอกจำนวนชั้น" })
    .int()
    .min(1, "จำนวนชั้นต้องมากกว่า 0"),
  elevatorBrand: z.string().optional(),
  elevatorModel: z.string().optional(),
  elevatorType: z.string().optional(),
  quantity: z
    .number({ invalid_type_error: "กรุณากรอกจำนวน" })
    .int()
    .min(1, "จำนวนต้องมากกว่า 0")
    .default(1),
});

export const createRepairJobSchema = jobBaseSchema.extend({
  jobType: z.literal("REPAIR"),
  elevatorModel: z.string().optional(),
  quantity: z
    .number({ invalid_type_error: "กรุณากรอกจำนวน" })
    .int()
    .min(1, "จำนวนต้องมากกว่า 0")
    .default(1),
});

export const createServiceJobSchema = jobBaseSchema.extend({
  jobType: z.literal("SERVICE"),
  elevatorModel: z.string().optional(),
  quantity: z
    .number({ invalid_type_error: "กรุณากรอกจำนวน" })
    .int()
    .min(1, "จำนวนต้องมากกว่า 0")
    .default(1),
});

export const createJobSchema = z.discriminatedUnion("jobType", [
  createInstallationJobSchema,
  createRepairJobSchema,
  createServiceJobSchema,
]);

export type CreateJobInput = z.infer<typeof createJobSchema>;
