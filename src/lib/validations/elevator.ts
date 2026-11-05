// src/lib/validations/elevator.ts
import { z } from "zod";

const optionalText = z
  .string()
  .trim()
  .max(500, "ข้อความยาวเกินไป")
  .optional()
  .transform((v) => (v ? v : null));

export const elevatorTypeSchema = z.object({
  name: z.string().trim().min(1, "กรุณากรอกชื่อประเภทลิฟต์").max(100, "ชื่อยาวเกินไป"),
  description: optionalText,
});

export const elevatorModelSchema = z.object({
  brand: z.string().trim().min(1, "กรุณากรอกยี่ห้อ").max(100, "ยี่ห้อยาวเกินไป"),
  name: z.string().trim().min(1, "กรุณากรอกชื่อรุ่น").max(100, "ชื่อรุ่นยาวเกินไป"),
  typeId: z.string().min(1, "กรุณาเลือกประเภทลิฟต์"),
  description: optionalText,
});

export type ElevatorTypeInput = z.input<typeof elevatorTypeSchema>;
export type ElevatorModelInput = z.input<typeof elevatorModelSchema>;
