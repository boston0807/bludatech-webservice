// src/app/api/jobs/[id]/expenses/[expenseId]/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { z } from "zod";

type Params = { params: Promise<{ id: string; expenseId: string }> };

const ALLOWED_ROLES = ["HEAD_TECHNICIAN", "TECHNICIAN", "ACCOUNTANT"] as const;

const updateExpenseSchema = z.object({
  expenseName: z.string().min(1, "กรุณากรอกชื่อรายการ").optional(),
  quantity: z.number().int().min(1, "จำนวนต้องมากกว่า 0").optional(),
  price: z.number().min(0, "ราคาต้องไม่ติดลบ").optional(),
});

// PATCH /api/jobs/:id/expenses/:expenseId — แก้ไขรายการค่าใช้จ่าย
export async function PATCH(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload || !ALLOWED_ROLES.includes(payload.role as (typeof ALLOWED_ROLES)[number])) {
    return forbiddenResponse();
  }

  const { id: jobId, expenseId } = await params;

  try {
    // ตรวจสอบว่า job มีอยู่จริง
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return notFoundResponse("ไม่พบใบงาน");

    // ตรวจสอบว่า expense มีอยู่จริงและเป็นของ job นี้
    const expense = await prisma.expense.findFirst({
      where: { id: parseInt(expenseId, 10), jobId },
    });
    if (!expense) return notFoundResponse("ไม่พบรายการค่าใช้จ่าย");

    const body = await req.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    const updated = await prisma.expense.update({
      where: { id: parseInt(expenseId, 10) },
      data: {
        ...(parsed.data.expenseName !== undefined && { expenseName: parsed.data.expenseName }),
        ...(parsed.data.quantity !== undefined && { quantity: parsed.data.quantity }),
        ...(parsed.data.price !== undefined && { price: parsed.data.price }),
      },
    });

    return successResponse(updated);
  } catch (error) {
    console.error("[UPDATE_EXPENSE_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการอัปเดตข้อมูล", 500);
  }
}

// DELETE /api/jobs/:id/expenses/:expenseId — ลบรายการค่าใช้จ่าย
export async function DELETE(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload || !ALLOWED_ROLES.includes(payload.role as (typeof ALLOWED_ROLES)[number])) {
    return forbiddenResponse();
  }

  const { id: jobId, expenseId } = await params;

  try {
    // ตรวจสอบว่า job มีอยู่จริง
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return notFoundResponse("ไม่พบใบงาน");

    // ตรวจสอบว่า expense มีอยู่จริงและเป็นของ job นี้
    const expense = await prisma.expense.findFirst({
      where: { id: parseInt(expenseId, 10), jobId },
    });
    if (!expense) return notFoundResponse("ไม่พบรายการค่าใช้จ่าย");

    await prisma.expense.delete({
      where: { id: parseInt(expenseId, 10) },
    });

    return successResponse({ message: "ลบรายการสำเร็จ" });
  } catch (error) {
    console.error("[DELETE_EXPENSE_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการลบข้อมูล", 500);
  }
}
