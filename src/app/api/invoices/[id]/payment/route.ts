// src/app/api/invoices/[id]/payment/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { ApiError, successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";
import { createPaymentSchema } from "@/lib/validations/payment";
import { Prisma } from "@prisma/client";
import { sendPaymentReceiptEmail } from "@/lib/email-notifications";

type Params = { params: Promise<{ id: string }> };

// POST /api/invoices/:id/payment - UC16 ชำระเงิน
export async function POST(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id: receiptId } = await params;
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    include: { job: true, payments: { select: { amount: true } } },
  });

  if (!receipt) return notFoundResponse("ไม่พบใบแจ้งหนี้");

  const isOwner = payload.role === "CUSTOMER" && receipt.job.customerId === payload.sub;
  if (!isOwner && payload.role !== "ACCOUNTANT" && payload.role !== "ADMIN") {
    return forbiddenResponse("คุณไม่มีสิทธิ์ชำระใบแจ้งหนี้นี้");
  }

  if (receipt.status !== "UNPAID") {
    return errorResponse("ใบแจ้งหนี้นี้ไม่อยู่ในสถานะรอชำระเงิน", 409);
  }

  const body = await req.json().catch(() => ({}));
  const parsed = createPaymentSchema.safeParse({ ...body, receiptId });
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422);
  }

  const { amount, paymentMethod, slipUrl } = parsed.data;

  // ยอดที่ชำระรวมทุกครั้งต้องไม่เกินยอดใบแจ้งหนี้ และครั้งนี้ต้องชำระส่วนที่เหลือครบพอดี
  const paidSoFar = receipt.payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
  const outstanding = receipt.totalAmount.minus(paidSoFar);
  if (outstanding.lessThanOrEqualTo(0)) {
    return errorResponse("ใบแจ้งหนี้นี้ชำระครบแล้ว", 409);
  }
  const amountDec = new Prisma.Decimal(amount).toDecimalPlaces(2);
  if (amountDec.greaterThan(outstanding)) {
    return errorResponse(`จำนวนเงินเกินยอดค้างชำระ (${outstanding.toFixed(2)} บาท)`, 422);
  }
  if (!amountDec.equals(outstanding)) {
    return errorResponse(`จำนวนเงินต้องเท่ากับยอดค้างชำระ ${outstanding.toFixed(2)} บาท`, 422);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // อัปเดตสถานะ Receipt เป็น PAID แบบมีเงื่อนไข กันการชำระซ้ำเมื่อมีคำขอพร้อมกัน
      const paidReceipt = await tx.receipt.updateMany({
        where: { id: receiptId, status: "UNPAID" },
        data: { status: "PAID" },
      });
      if (paidReceipt.count === 0) {
        throw new ApiError("ใบแจ้งหนี้นี้ไม่อยู่ในสถานะรอชำระเงิน", 409);
      }

      // สร้างรายการ payment
      const payment = await tx.payment.create({
        data: {
          receiptId,
          amount: amountDec,
          paymentMethod,
          slipUrl: slipUrl || null,
          verified: true, // หรือ false ถ้ารอตรวจสอบ
        },
      });

      // UC16 ชำระเงินแล้ว ใบงานเป็น PAID และรอธุรการ (Admin) อนุมัติบันทึกประวัติ (UC17)
      const paidJob = await tx.job.updateMany({
        where: { id: receipt.jobId, status: "ACCEPTED" },
        data: { status: "PAID" },
      });
      if (paidJob.count === 0) {
        throw new ApiError("ใบงานนี้ไม่อยู่ในสถานะที่ชำระเงินได้", 409);
      }

      return payment;
    });

    // แจ้งลูกค้าพร้อมรายละเอียดใบเสร็จ (ไม่รอผล ไม่ให้อีเมลล้มเหลวกระทบการชำระเงิน)
    const customer = await prisma.customer.findUnique({
      where: { id: receipt.job.customerId },
      select: { customerName: true, customerEmail: true },
    });
    if (customer?.customerEmail) {
      sendPaymentReceiptEmail({
        to: customer.customerEmail,
        customerName: customer.customerName,
        jobId: receipt.jobId,
        receiptId: receipt.id,
        amount: result.amount.toString(),
        paymentMethod: result.paymentMethod,
        paymentDate: result.paymentDate,
      });
    }

    return successResponse(result, "ชำระเงินสำเร็จ");
  } catch (error: any) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    return errorResponse(error.message || "เกิดข้อผิดพลาดในการชำระเงิน", 500);
  }
}
