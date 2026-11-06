// src/app/api/admin/employees/[id]/route.ts
// ธุรการแก้ไขชื่อ/ตำแหน่ง หรือตั้งรหัสผ่านใหม่ให้พนักงาน
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { updateEmployeeSchema } from "@/lib/validations/auth";
import { EMPLOYEE_SELECT } from "@/lib/employees";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  const { id } = await params;
  const employee = await prisma.employee.findUnique({ where: { id }, select: { id: true, role: true } });
  if (!employee) return notFoundResponse("ไม่พบพนักงาน");

  const body = await req.json().catch(() => null);
  const parsed = updateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { employeeName, role, newPassword } = parsed.data;
  if (!employeeName && !role && !newPassword) return errorResponse("ไม่มีข้อมูลที่ต้องแก้ไข", 422);

  if (role && role !== employee.role) {
    // กันธุรการลดสิทธิ์ตัวเองจนไม่มีใครเข้าหน้าจัดการได้
    if (id === auth.sub) return errorResponse("ไม่สามารถเปลี่ยนตำแหน่งของตัวเองได้", 422);
    if (employee.role === "ADMIN") {
      const admins = await prisma.employee.count({ where: { role: "ADMIN" } });
      if (admins <= 1) return errorResponse("ต้องมีธุรการ (ADMIN) อย่างน้อย 1 คน", 422);
    }
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...(employeeName ? { employeeName } : {}),
      ...(role ? { role } : {}),
      ...(newPassword ? { password: await bcrypt.hash(newPassword, 12) } : {}),
    },
    select: EMPLOYEE_SELECT,
  });

  return successResponse(updated, newPassword ? "ตั้งรหัสผ่านใหม่สำเร็จ" : "บันทึกข้อมูลพนักงานสำเร็จ");
}
