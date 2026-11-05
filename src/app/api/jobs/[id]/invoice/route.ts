// src/app/api/jobs/[id]/invoice/route.ts
// UC15 ออกใบแจ้งหนี้
// ระบบออกใบแจ้งหนี้ร่าง (DRAFT) ให้อัตโนมัติตอนลูกค้าตรวจรับงาน (ดู /api/jobs/:id/accept)
// พนักงานบัญชีมีหน้าที่ "ตรวจสอบและยืนยัน" → UNPAID แล้วระบบส่งให้ลูกค้า (BP ข้อ 17)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import {
  ApiError,
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { sendInvoiceIssuedEmail } from "@/lib/email";

type Params = { params: Promise<{ id: string }> };

// POST /api/jobs/:id/invoice — ยืนยันใบแจ้งหนี้ร่าง (หรือออกใบใหม่ถ้างานเก่ายังไม่มีใบร่าง)
export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ACCOUNTANT" && auth.role !== "ADMIN") {
    return forbiddenResponse("เฉพาะพนักงานบัญชีที่สามารถออกใบแจ้งหนี้ได้");
  }

  const { id: jobId } = await params;
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { quotation: true, receipt: true, customer: true },
  });

  if (!job) return notFoundResponse("ไม่พบใบงาน");
  if (job.status !== "ACCEPTED") {
    return errorResponse("ใบงานต้องอยู่ในสถานะ ACCEPTED (ลูกค้าตรวจรับงานแล้ว) จึงจะออกใบแจ้งหนี้ได้", 422);
  }
  if (!job.quotation || job.quotation.status !== "APPROVED") {
    return errorResponse("ไม่พบใบเสนอราคาที่อนุมัติแล้วสำหรับใบงานนี้", 422);
  }
  if (job.receipt && job.receipt.status !== "DRAFT") {
    return errorResponse("ใบงานนี้มีการออกใบแจ้งหนี้ไปแล้ว", 422);
  }

  try {
    const receipt = await prisma.$transaction(async (tx) => {
      if (job.receipt) {
        const confirmed = await tx.receipt.updateMany({
          where: { id: job.receipt.id, status: "DRAFT" },
          // ยอดอ้างอิงใบเสนอราคาที่อนุมัติเสมอ
          data: { status: "UNPAID", employeeId: auth.sub, totalAmount: job.quotation!.totalAmount },
        });
        if (confirmed.count === 0) throw new ApiError("ใบแจ้งหนี้นี้ถูกยืนยันไปแล้ว", 409);
        return tx.receipt.findUnique({ where: { id: job.receipt.id } });
      }
      return tx.receipt.create({
        data: { jobId, employeeId: auth.sub, totalAmount: job.quotation!.totalAmount, status: "UNPAID" },
      });
    });

    if (receipt && job.customer.customerEmail) {
      sendInvoiceIssuedEmail({
        to: job.customer.customerEmail,
        customerName: job.customer.customerName,
        jobId,
        invoiceId: receipt.id,
        totalAmount: job.quotation.totalAmount.toString(),
      });
    }

    return successResponse(receipt, "ตรวจสอบและส่งใบแจ้งหนี้ให้ลูกค้าสำเร็จ");
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[ISSUE_INVOICE_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการออกใบแจ้งหนี้", 500);
  }
}

// GET /api/jobs/:id/invoice
export async function GET(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();

  const { id: jobId } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { jobId },
    include: {
      payments: true,
      employee: { select: { employeeName: true } },
      job: {
        include: {
          customer: { omit: { password: true } },
          quotation: true,
        },
      },
    },
  });

  if (!receipt) return notFoundResponse("ไม่พบใบแจ้งหนี้");
  if (auth.role === "CUSTOMER") {
    if (receipt.job.customerId !== auth.sub) return forbiddenResponse("คุณไม่มีสิทธิ์ดูใบแจ้งหนี้นี้");
    // ใบร่างยังไม่ผ่านการตรวจสอบจากฝ่ายบัญชี ลูกค้ายังไม่เห็น
    if (receipt.status === "DRAFT") return notFoundResponse("ใบแจ้งหนี้อยู่ระหว่างการตรวจสอบโดยฝ่ายบัญชี");
  }
  return successResponse(receipt);
}
