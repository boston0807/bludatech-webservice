// src/app/api/admin/customers/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  // Auth: อ่าน JWT จาก cookie โดยตรง
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "ADMIN") return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "PENDING") as "PENDING" | "ACTIVE" | "REJECTED";

  const customers = await prisma.customer.findMany({
    where: { status },
    select: {
      id: true,
      username: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      taxId: true,
      customerAddress: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return successResponse(customers);
}
