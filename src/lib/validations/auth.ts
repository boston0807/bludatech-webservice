// src/lib/validations/auth.ts
import { z } from "zod";

export const loginSchema = z.object({
  username: z
    .string()
    .min(1, "กรุณากรอก Username, อีเมล หรือเบอร์โทร")
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

// ลูกค้าที่ถูกปฏิเสธแก้ไขข้อมูลแล้วส่งใหม่ (ยืนยันตัวตนด้วย username + รหัสผ่านเดิม)
export const resubmitSchema = z.object({
  username: z.string().min(1, "กรุณากรอก Username"),
  password: z.string().min(1, "กรุณากรอกรหัสผ่าน"),
  customerName: z.string().min(1, "กรุณากรอกชื่อ-นามสกุล").max(100, "ชื่อยาวเกินไป"),
  customerAddress: z.string().min(1, "กรุณากรอกที่อยู่"),
  customerPhone: z
    .string()
    .regex(/^0[689]\d{8}$/, "เบอร์โทรต้องเป็น 10 หลัก ขึ้นต้นด้วย 06, 08 หรือ 09"),
  customerEmail: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  taxId: z.string().max(20, "รหัสผู้เสียภาษียาวเกินไป").optional().or(z.literal("")),
});

// เปลี่ยนรหัสผ่าน (ทุกบทบาท)
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),
    newPassword: z
      .string()
      .min(8, "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร")
      .max(100, "รหัสผ่านยาวเกินไป"),
    confirmPassword: z.string().min(1, "กรุณายืนยันรหัสผ่านใหม่"),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "รหัสผ่านใหม่ไม่ตรงกัน",
    path: ["confirmPassword"],
  })
  .refine((d) => d.newPassword !== d.currentPassword, {
    message: "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม",
    path: ["newPassword"],
  });

// ลูกค้าแก้ไขข้อมูลติดต่อของตัวเอง
export const updateProfileSchema = z.object({
  customerName: z.string().trim().min(1, "กรุณากรอกชื่อ-นามสกุล").max(100, "ชื่อยาวเกินไป"),
  customerAddress: z.string().trim().min(1, "กรุณากรอกที่อยู่").max(500, "ที่อยู่ยาวเกินไป"),
  customerPhone: z
    .string()
    .trim()
    .regex(/^0[689]\d{8}$/, "เบอร์โทรต้องเป็น 10 หลัก ขึ้นต้นด้วย 06, 08 หรือ 09"),
  customerEmail: z.string().trim().email("รูปแบบอีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  // เกณฑ์เดียวกับตอนสมัคร (ข้อมูลเดิมจะได้บันทึกซ้ำได้)
  taxId: z.string().trim().max(20, "รหัสผู้เสียภาษียาวเกินไป").optional().or(z.literal("")),
});

// ธุรการจัดการบัญชีพนักงาน
export const EMPLOYEE_ROLES = ["ADMIN", "ACCOUNTANT", "TECHNICIAN", "HEAD_TECHNICIAN"] as const;

export const createEmployeeSchema = z.object({
  username: z
    .string()
    .trim()
    .min(4, "Username ต้องมีอย่างน้อย 4 ตัวอักษร")
    .max(50, "Username ยาวเกินไป")
    .regex(/^[a-zA-Z0-9_]+$/, "Username ใช้ได้เฉพาะ a-z, A-Z, 0-9 และ _"),
  password: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(100, "รหัสผ่านยาวเกินไป"),
  employeeName: z.string().trim().min(1, "กรุณากรอกชื่อพนักงาน").max(100, "ชื่อยาวเกินไป"),
  role: z.enum(EMPLOYEE_ROLES, { errorMap: () => ({ message: "กรุณาเลือกตำแหน่ง" }) }),
});

export const updateEmployeeSchema = z.object({
  employeeName: z.string().trim().min(1, "กรุณากรอกชื่อพนักงาน").max(100, "ชื่อยาวเกินไป").optional(),
  role: z.enum(EMPLOYEE_ROLES).optional(),
  // ตั้งรหัสผ่านใหม่ให้พนักงานที่ลืมรหัสผ่าน
  newPassword: z.string().min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร").max(100, "รหัสผ่านยาวเกินไป").optional(),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type ResubmitInput = z.infer<typeof resubmitSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
