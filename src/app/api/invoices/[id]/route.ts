import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, notFoundResponse } from "@/lib/api-response";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();

  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { id } = await params;

  const receipt = await prisma.receipt.findUnique({
    where: { id },
    include: {
      employee: { select: { employeeName: true } },
      payments: true,
      job: {
        include: {
          customer: true,
          quotation: true,
        },
      },
    },
  });

  if (!receipt) return notFoundResponse("ไม่พบใบแจ้งหนี้");

  if (payload.role === "CUSTOMER" && receipt.job.customerId !== payload.sub) {
    return forbiddenResponse("คุณไม่มีสิทธิ์ดูใบแจ้งหนี้นี้");
  }

  if (payload.role !== "ADMIN" && payload.role !== "ACCOUNTANT" && payload.role !== "CUSTOMER") {
    return forbiddenResponse("คุณไม่มีสิทธิ์ดูข้อมูลใบแจ้งหนี้");
  }

  return successResponse(receipt);
}
