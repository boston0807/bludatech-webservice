// src/app/api/invoices/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import type { Prisma, ReceiptStatus } from "@prisma/client";
import { jobTypeParam, optionalDateFilter, searchTerm } from "@/lib/list-filters";

const RECEIPT_STATUSES: ReceiptStatus[] = ["DRAFT", "UNPAID", "PAID", "CANCELLED"];

// GET /api/invoices - ดึงรายการใบแจ้งหนี้ทั้งหมด (Receipts)
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  // ตัวกรอง: ?status= &q=ชื่อลูกค้า/ที่อยู่/เลขที่ &jobType= &from= &to= (ตามวันที่ออกใบ)
  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  if (statusParam && !(RECEIPT_STATUSES as string[]).includes(statusParam)) {
    return errorResponse("status ไม่ถูกต้อง", 422);
  }
  const q = searchTerm(searchParams);
  const jobType = jobTypeParam(searchParams);
  const createdAt = optionalDateFilter(searchParams);
  const filters: Prisma.ReceiptWhereInput[] = [];
  if (statusParam) filters.push({ status: statusParam as ReceiptStatus });
  if (jobType) filters.push({ job: { jobType } });
  if (createdAt) filters.push({ createdAt });
  if (q) {
    filters.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { jobId: { contains: q, mode: "insensitive" } },
        { job: { jobAddress: { contains: q, mode: "insensitive" } } },
        { job: { customer: { customerName: { contains: q, mode: "insensitive" } } } },
      ],
    });
  }

  try {
    let receipts;
    if (payload.role === "CUSTOMER") {
      // ลูกค้าดูเฉพาะใบแจ้งหนี้ของตัวเอง
      receipts = await prisma.receipt.findMany({
        where: {
          AND: [
            ...filters,
            { job: { customerId: payload.sub } },
            { status: { not: "DRAFT" } }, // ใบร่างรอฝ่ายบัญชีตรวจสอบ ยังไม่ส่งถึงลูกค้า
          ],
        },
        include: {
          job: { include: { customer: { omit: { password: true } } } },
          payments: true,
          employee: { select: { employeeName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (payload.role === "ADMIN" || payload.role === "ACCOUNTANT") {
      // ธุรการ / บัญชี ดูทั้งหมด (ช่างไม่มีสิทธิ์ดูข้อมูลการเงิน — สอดคล้องกับ /api/invoices/:id)
      receipts = await prisma.receipt.findMany({
        where: filters.length ? { AND: filters } : {},
        include: {
          job: { include: { customer: { omit: { password: true } } } },
          payments: true,
          employee: { select: { employeeName: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      return forbiddenResponse("คุณไม่มีสิทธิ์ดูข้อมูลใบแจ้งหนี้");
    }

    return successResponse(receipts);
  } catch (error: any) {
    return errorResponse(error.message || "เกิดข้อผิดพลาดในการดึงข้อมูลใบแจ้งหนี้", 500);
  }
}
