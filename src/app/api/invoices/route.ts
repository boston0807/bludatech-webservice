// src/app/api/invoices/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";

// GET /api/invoices - ดึงรายการใบแจ้งหนี้ทั้งหมด (Receipts)
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  try {
    let receipts;
    if (payload.role === "CUSTOMER") {
      // ลูกค้าดูเฉพาะใบแจ้งหนี้ของตัวเอง
      receipts = await prisma.receipt.findMany({
        where: {
          job: {
            customerId: payload.sub,
          },
        },
        include: {
          job: { include: { customer: true } },
          payments: true,
          employee: { select: { employeeName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      // พนักงาน / ผู้บริหาร / บัญชี ดูทั้งหมด
      receipts = await prisma.receipt.findMany({
        include: {
          job: { include: { customer: true } },
          payments: true,
          employee: { select: { employeeName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    }

    return successResponse(receipts);
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลใบแจ้งหนี้", 500);
  }
}
