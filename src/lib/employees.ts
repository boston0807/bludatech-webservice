// src/lib/employees.ts — ฟิลด์ที่ส่งกลับเมื่อดึงข้อมูลพนักงาน (ไม่ส่งรหัสผ่าน)
export const EMPLOYEE_SELECT = {
  id: true,
  username: true,
  employeeName: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { surveys: true } },
} as const;
