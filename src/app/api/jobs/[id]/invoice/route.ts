// src/app/api/jobs/[id]/invoice/route.ts
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
import { sendInvoiceIssuedEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// POST /api/jobs/:id/invoice - UC15 ออกใบแจ้งหนี้
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  if (payload.role !== "ACCOUNTANT" && payload.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะพนักงานบัญชีที่สามารถออกใบแจ้งหนี้ได้");
  }

  const { id: jobId } = await params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { quotation: true, receipt: true, customer: true },
  });

  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "ACCEPTED") {
    return errorResponse(
      "ใบงานต้องอยู่ในสถานะ ACCEPTED (ลูกค้าตรวจรับงานแล้ว) จึงจะออกใบแจ้งหนี้ได้",
      422
    );
  }
  if (!job.quotation) {
    return errorResponse("ไม่พบใบเสนอราคาสำหรับใบงานนี้", 422);
  }
  if (job.receipt) {
    return errorResponse("ใบงานนี้มีการออกใบแจ้งหนี้ไปแล้ว", 422);
  }

  try {
    const receipt = await prisma.receipt.create({
      data: {
        jobId,
        employeeId: payload.sub,
        totalAmount: job.quotation.totalAmount,
        status: "UNPAID",
      },
      include: { job: { include: { customer: true } }, employee: true },
    });

    // ส่งอีเมลแจ้งลูกค้าว่ามีใบแจ้งหนี้พร้อมชำระ (fire-and-forget)
    if (job.customer.customerEmail) {
      sendInvoiceIssuedEmail({
        to: job.customer.customerEmail,
        customerName: job.customer.customerName,
        jobId,
        invoiceId: receipt.id,
        totalAmount: job.quotation.totalAmount.toString(),
      });
    }

    return successResponse(receipt, "ออกใบแจ้งหนี้สำเร็จ");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
    return errorResponse(message, 500);
  }
}

// GET /api/jobs/:id/invoice
export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id: jobId } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { jobId },
    include: {
      payments: true,
      employee: { select: { employeeName: true } },
      job: {
        include: {
          customer: true,
          quotation: true,
        },
      },
    },
  });

  if (!receipt) return notFoundResponse("ไม่พบใบแจ้งหนี้");
  return successResponse(receipt);
}
