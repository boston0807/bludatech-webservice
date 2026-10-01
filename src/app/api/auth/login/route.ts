// src/app/api/auth/login/route.ts
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { signToken, AUTH_COOKIE_NAME, getAuthCookieOptions, type JWTPayload } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    const { username, password } = parsed.data;

    // ── Try Customer ──────────────────────────────────────────
    const customer = await prisma.customer.findUnique({ where: { username } });

    if (customer) {
      if (customer.status === "PENDING") {
        return errorResponse("บัญชีของคุณยังรอการอนุมัติจากเจ้าหน้าที่", 403);
      }
      if (customer.status === "REJECTED") {
        return errorResponse("บัญชีของคุณถูกปฏิเสธ กรุณาติดต่อเจ้าหน้าที่", 403);
      }

      const valid = await bcrypt.compare(password, customer.password);
      if (!valid) {
        return errorResponse("Username หรือรหัสผ่านไม่ถูกต้อง", 401);
      }

      const payload: JWTPayload = {
        sub: customer.id,
        username: customer.username,
        role: "CUSTOMER",
        name: customer.customerName,
      };

      const token = await signToken(payload);

      const response = NextResponse.json({
        success: true,
        data: {
          user: { id: customer.id, username: customer.username, name: customer.customerName, role: "CUSTOMER" },
          redirectTo: "/dashboard",
        },
      });

      response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
      return response;
    }

    // ── Try Employee ──────────────────────────────────────────
    const employee = await prisma.employee.findUnique({ where: { username } });

    if (employee) {
      const valid = await bcrypt.compare(password, employee.password);
      if (!valid) {
        return errorResponse("Username หรือรหัสผ่านไม่ถูกต้อง", 401);
      }

      const roleMap: Record<string, JWTPayload["role"]> = {
        ADMIN: "ADMIN",
        ACCOUNTANT: "ACCOUNTANT",
        TECHNICIAN: "TECHNICIAN",
        HEAD_TECHNICIAN: "HEAD_TECHNICIAN",
      };

      const redirectMap: Record<string, string> = {
        ADMIN: "/admin/dashboard",
        ACCOUNTANT: "/accountant/dashboard",
        TECHNICIAN: "/technician/dashboard",
        HEAD_TECHNICIAN: "/technician/dashboard",
      };

      const payload: JWTPayload = {
        sub: employee.id,
        username: employee.username,
        role: roleMap[employee.role],
        name: employee.employeeName,
      };

      const token = await signToken(payload);

      const response = NextResponse.json({
        success: true,
        data: {
          user: { id: employee.id, username: employee.username, name: employee.employeeName, role: employee.role },
          redirectTo: redirectMap[employee.role] ?? "/dashboard",
        },
      });

      response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
      return response;
    }

    return errorResponse("Username หรือรหัสผ่านไม่ถูกต้อง", 401);
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดภายในระบบ", 500);
  }
}
