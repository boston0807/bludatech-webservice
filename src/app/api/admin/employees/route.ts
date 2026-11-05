// src/app/api/admin/employees/route.ts
// ธุรการจัดการบัญชีพนักงาน — GET รายชื่อ (?q=&role=), POST สร้างบัญชีใหม่
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import type { EmployeeRole, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { createEmployeeSchema, EMPLOYEE_ROLES } from "@/lib/validations/auth";
import { searchTerm } from "@/lib/list-filters";
import { EMPLOYEE_SELECT } from "@/lib/employees";

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const q = searchTerm(searchParams);
  const role = searchParams.get("role");
  if (role && !(EMPLOYEE_ROLES as readonly string[]).includes(role)) {
    return errorResponse("role ไม่ถูกต้อง", 422);
  }

  const where: Prisma.EmployeeWhereInput = {
    ...(role ? { role: role as EmployeeRole } : {}),
    ...(q
      ? {
          OR: [
            { employeeName: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const employees = await prisma.employee.findMany({
    where,
    select: EMPLOYEE_SELECT,
    orderBy: [{ role: "asc" }, { employeeName: "asc" }],
  });
  return successResponse(employees);
}

export async function POST(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse();

  const body = await req.json().catch(() => null);
  const parsed = createEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { username, password, employeeName, role } = parsed.data;

  // username ต้องไม่ซ้ำทั้งลูกค้าและพนักงาน (login ค้นหาจากทั้งสองตาราง)
  const [customer, employee] = await Promise.all([
    prisma.customer.findUnique({ where: { username }, select: { id: true } }),
    prisma.employee.findUnique({ where: { username }, select: { id: true } }),
  ]);
  if (customer || employee) {
    return errorResponse("Username นี้ถูกใช้งานแล้ว", 409, { username: ["Username นี้ถูกใช้งานแล้ว"] });
  }

  const created = await prisma.employee.create({
    data: { username, employeeName, role, password: await bcrypt.hash(password, 12) },
    select: EMPLOYEE_SELECT,
  });
  return successResponse(created, "สร้างบัญชีพนักงานสำเร็จ");
}
