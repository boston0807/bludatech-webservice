// src/app/api/invoices/[id]/payment/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, notFoundResponse } from "@/lib/api-response";
import { createPaymentSchema } from "@/lib/validations/payment";
import { saveJobHistory } from "@/lib/service-history";

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
    include: { job: true },
  });

  if (!receipt) return notFoundResponse("ไม่พบใบแจ้งหนี้");

  const body = await req.json();
  const parsed = createPaymentSchema.safeParse({ ...body, receiptId });
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422);
  }

  const { amount, paymentMethod, slipUrl } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // สร้างรายการ payment
      const payment = await tx.payment.create({
        data: {
          receiptId,
          amount,
          paymentMethod,
          slipUrl: slipUrl || null,
          verified: true, // หรือ false ถ้ารอตรวจสอบ
        },
      });

      // อัปเดตสถานะ Receipt เป็น PAID
      await tx.receipt.update({
        where: { id: receiptId },
        data: { status: "PAID" },
      });

      // UC16 ชำระเงินแล้วต่อด้วย UC17 บันทึกประวัติใน transaction เดียวกัน
      await tx.job.update({
        where: { id: receipt.jobId },
        data: { status: "PAID" },
      });

      await saveJobHistory(tx, receipt.jobId);

      return payment;
    });

    return successResponse(result, "ชำระเงินสำเร็จ");
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาดในการชำระเงิน", 500);
  }
}
