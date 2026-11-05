// src/app/api/jobs/[id]/quotation/route.ts
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
import { sendQuotationCreatedEmail } from "@/lib/email";
import { canTransition, transitionJob } from "@/lib/job-status";
import { Notify } from "@/lib/notifications";
import { ApiError } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

// ยอดรวมคำนวณที่ server เสมอ = ค่าอะไหล่จากผลสำรวจ (expenses) + ค่าแรง (UC06 ข้อ 7)
// ไม่รับ totalAmount จากหน้าเว็บ กันยอดไม่ตรงกับรายการที่ช่างประเมิน (ปัญหาข้อ 2)
const createQuotationBodySchema = z.object({
  jobWage: z
    .number({ invalid_type_error: "กรุณากรอกค่าแรงเป็นตัวเลข" })
    .min(0, "ค่าแรงต้องไม่ติดลบ")
    .default(0),
});

// POST /api/jobs/:id/quotation — สร้างใบเสนอราคา (ACCOUNTANT เท่านั้น)
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "ACCOUNTANT") return forbiddenResponse();

  const { id: jobId } = await params;

  try {
    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: { quotation: true, customer: true, expenses: true },
    });
    if (!job) return notFoundResponse("ไม่พบใบงาน");

    // ใบเสนอราคาเดิมต้องถูกปฏิเสธแล้วเท่านั้นจึงจะออกใหม่ได้
    if (job.quotation && job.quotation.status !== "REJECTED") {
      return errorResponse("ใบงานนี้มีใบเสนอราคาแล้ว", 409);
    }

    if (!canTransition(job.status, "QUOTED", payload.role)) {
      return errorResponse("ใบงานนี้ไม่อยู่ในสถานะที่จัดทำใบเสนอราคาได้", 422);
    }

    const body = await req.json();
    const parsed = createQuotationBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    const jobWage = Math.round(parsed.data.jobWage * 100) / 100;
    const materialTotal = job.expenses.reduce((sum, e) => sum + Number(e.price) * e.quantity, 0);
    const totalAmount = Math.round((materialTotal + jobWage) * 100) / 100;

    // สร้าง quotation และอัปเดต job status และ jobWage ใน transaction
    const quotation = await prisma.$transaction(async (tx) => {
      await transitionJob(tx, {
        jobId,
        to: "QUOTED",
        role: payload.role,
        data: { jobWage },
        conflictMessage: "ใบงานนี้ไม่อยู่ในสถานะที่จัดทำใบเสนอราคาได้ (อาจมีผู้อื่นออกใบเสนอราคาไปแล้ว)",
      });
      return tx.quotation.upsert({
        where: { jobId },
        create: { jobId, totalAmount, status: "PENDING" },
        update: { totalAmount, status: "PENDING", rejectNote: null },
      });
    });

    await Notify.quotationCreated({ jobId, customerId: job.customerId, totalAmount });

    // ส่งอีเมลแจ้งลูกค้าว่ามีใบเสนอราคาพร้อมให้อนุมัติ (fire-and-forget)
    if (job.customer.customerEmail) {
      sendQuotationCreatedEmail({
        to: job.customer.customerEmail,
        customerName: job.customer.customerName,
        jobId,
        totalAmount,
      });
    }

    return successResponse({ ...quotation, materialTotal, jobWage }, 201);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[CREATE_QUOTATION_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการสร้างใบเสนอราคา", 500);
  }
}

// GET /api/jobs/:id/quotation — ดึงใบเสนอราคาของ job (ผู้ใช้ที่ login แล้วทุกคน)
export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id: jobId } = await params;

  try {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) return notFoundResponse("ไม่พบใบงาน");

    // Customer เห็นเฉพาะ job ของตัวเอง
    if (payload.role === "CUSTOMER" && job.customerId !== payload.sub) {
      return forbiddenResponse();
    }

    const quotation = await prisma.quotation.findUnique({
      where: { jobId },
    });

    if (!quotation) return notFoundResponse("ไม่พบใบเสนอราคา");

    return successResponse(quotation);
  } catch (error) {
    console.error("[GET_QUOTATION_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาด", 500);
  }
}
