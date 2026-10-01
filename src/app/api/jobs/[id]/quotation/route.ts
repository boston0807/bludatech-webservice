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

type Params = { params: Promise<{ id: string }> };

const createQuotationBodySchema = z.object({
  totalAmount: z
    .number({ invalid_type_error: "กรุณากรอกจำนวนเงิน" })
    .min(0, "จำนวนเงินต้องไม่ติดลบ"),
  jobWage: z.number().min(0).optional(),
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
      include: { quotation: true },
    });
    if (!job) return notFoundResponse("ไม่พบใบงาน");

    // ตรวจสอบว่ายังไม่มีใบเสนอราคา
    if (job.quotation) {
      return errorResponse("ใบงานนี้มีใบเสนอราคาแล้ว", 409);
    }

    const body = await req.json();
    const parsed = createQuotationBodySchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    // สร้าง quotation และอัปเดต job status และ jobWage ใน transaction
    const [quotation] = await prisma.$transaction([
      prisma.quotation.create({
        data: {
          jobId,
          totalAmount: parsed.data.totalAmount,
          status: "PENDING",
        },
      }),
      prisma.job.update({
        where: { id: jobId },
        data: {
          status: "QUOTED",
          ...(parsed.data.jobWage !== undefined && { jobWage: parsed.data.jobWage }),
        },
      }),
    ]);

    return successResponse(quotation, 201);
  } catch (error) {
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
