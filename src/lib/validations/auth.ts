// src/lib/validations/auth.ts
import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "กรุณากรอก Username หรืออีเมล")
    .max(100, "Username ยาวเกินไป"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
});

export const registerSchema = z
  .object({
    username: z
      .string()
      .min(4, "Username ต้องมีอย่างน้อย 4 ตัวอักษร")
      .max(50, "Username ยาวเกินไป")
      .regex(/^[a-zA-Z0-9_]+$/, "Username ใช้ได้เฉพาะ a-z, A-Z, 0-9 และ _"),
    password: z
      .string()
      .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
      .max(100, "รหัสผ่านยาวเกินไป"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่าน"),
    customerName: z
      .string()
      .min(1, "กรุณากรอกชื่อ-นามสกุล")
      .max(100, "ชื่อยาวเกินไป"),
    customerAddress: z.string().min(1, "กรุณากรอกที่อยู่"),
    customerPhone: z
      .string()
      .regex(
        /^0[689]\d{8}$/,
        "เบอร์โทรต้องเป็น 10 หลัก ขึ้นต้นด้วย 06, 08 หรือ 09"
      ),
    customerEmail: z
      .string()
      .email("รูปแบบอีเมลไม่ถูกต้อง")
      .optional()
      .or(z.literal("")),
    taxId: z.string().max(20, "รหัสผู้เสียภาษียาวเกินไป").optional().or(z.literal("")),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "รหัสผ่านไม่ตรงกัน",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
