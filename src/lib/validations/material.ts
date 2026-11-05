// src/lib/validations/material.ts
import { z } from "zod";

const MAX_QTY = 100_000;

export const createMaterialSchema = z.object({
  materialName: z.string().trim().min(1, "กรุณากรอกชื่อวัสดุ").max(200),
  price: z.coerce
    .number({ invalid_type_error: "ราคาต้องเป็นตัวเลข" })
    .min(0, "ราคาต้องไม่ติดลบ")
    .max(99_999_999.99, "ราคาสูงเกินไป"),
  stockQuantity: z.coerce
    .number({ invalid_type_error: "จำนวนต้องเป็นตัวเลข" })
    .int("จำนวนต้องเป็นจำนวนเต็ม")
    .min(0, "จำนวนเริ่มต้นต้องไม่ติดลบ")
    .max(MAX_QTY)
    .default(0),
});

// UC11 รับของเข้าคลัง — รับเฉพาะจำนวนเต็มบวก (การลดยอดต้องผ่านการเบิกใช้ในแผนงานเท่านั้น)
export const restockSchema = z.object({
  addQuantity: z
    .number({ required_error: "กรุณาระบุจำนวนที่ต้องการเพิ่ม", invalid_type_error: "จำนวนต้องเป็นตัวเลข" })
    .int("จำนวนต้องเป็นจำนวนเต็ม")
    .min(1, "จำนวนต้องมากกว่า 0")
    .max(MAX_QTY, `เติมได้ไม่เกิน ${MAX_QTY.toLocaleString()} ชิ้นต่อครั้ง`),
  note: z.string().trim().max(500).optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type RestockInput = z.infer<typeof restockSchema>;
