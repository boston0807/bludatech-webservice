// src/app/api/jobs/[id]/expenses/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { createExpensesSchema } from "@/lib/validations/survey";
import { EXPENSE_EDITABLE_STATUSES, EXPENSE_LOCKED_MESSAGE } from "@/lib/expenses";

type Params = { params: Promise<{ id: string }> };

// GET /api/jobs/:id/expenses
export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id: jobId } = await params;

  const job = await prisma.job.findUnique({ where: { id: jobId }, select: { customerId: true } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  // ลูกค้าเห็นเฉพาะรายการของใบงานตัวเอง
  if (payload.role === "CUSTOMER" && job.customerId !== payload.sub) return forbiddenResponse();

  const expenses = await prisma.expense.findMany({
    where: { jobId },
    orderBy: { id: "asc" },
  });

  return successResponse(expenses);
}

// POST /api/jobs/:id/expenses — บันทึกรายการค่าใช้จ่ายหลายรายการ
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload || !["HEAD_TECHNICIAN", "TECHNICIAN", "ACCOUNTANT"].includes(payload.role)) {
    return forbiddenResponse();
  }

  const { id: jobId } = await params;

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (!EXPENSE_EDITABLE_STATUSES.includes(job.status)) return errorResponse(EXPENSE_LOCKED_MESSAGE, 422);

  const body = await req.json().catch(() => ({}));
  const parsed = createExpensesSchema.safeParse({ ...body, jobId });
  if (!parsed.success) {
    return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  }

  try {
    const created = await prisma.$transaction(
      parsed.data.expenses.map((e) =>
        prisma.expense.create({
          data: {
            jobId,
            expenseName: e.expenseName,
            quantity: e.quantity,
            price: e.price,
          },
        })
      )
    );

    return successResponse(created, 201);
  } catch (error) {
    console.error("[CREATE_EXPENSES_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการบันทึกข้อมูล", 500);
  }
}
