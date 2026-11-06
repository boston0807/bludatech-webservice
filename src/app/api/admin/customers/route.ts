// src/app/api/admin/customers/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, forbiddenResponse, unauthorizedResponse } from "@/lib/api-response";
import type { Prisma } from "@prisma/client";
import { optionalDateFilter, searchTerm } from "@/lib/list-filters";

export async function GET(req: NextRequest) {
  // Auth: อ่าน JWT จาก cookie โดยตรง
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();

  const payload = await verifyToken(token);
  if (!payload || payload.role !== "ADMIN") return forbiddenResponse();

  const { searchParams } = new URL(req.url);
  const status = (searchParams.get("status") ?? "PENDING") as "PENDING" | "ACTIVE" | "REJECTED" | "ALL";
  if (!["PENDING", "ACTIVE", "REJECTED", "ALL"].includes(status)) {
    return errorResponse("status ต้องเป็น PENDING, ACTIVE, REJECTED หรือ ALL", 422);
  }

  // ?q= ค้นหาชื่อ/username/เบอร์โทร/อีเมล/เลขผู้เสียภาษี, ?from=&to= ตามวันที่สมัคร
  const q = searchTerm(searchParams);
  const createdAt = optionalDateFilter(searchParams);
  const where: Prisma.CustomerWhereInput = {
    ...(status !== "ALL" ? { status } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(q
      ? {
          OR: [
            { customerName: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { customerPhone: { contains: q } },
            { customerEmail: { contains: q, mode: "insensitive" } },
            { taxId: { contains: q } },
          ],
        }
      : {}),
  };

  const customers = await prisma.customer.findMany({
    where,
    select: {
      id: true,
      username: true,
      customerName: true,
      customerPhone: true,
      customerEmail: true,
      taxId: true,
      customerAddress: true,
      status: true,
      rejectNote: true, // ถ้าเป็นลูกค้าที่แก้ไขแล้วส่งใหม่ จะเห็นเหตุผลที่เคยไม่อนุมัติ
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return successResponse(customers);
}
