// src/app/api/auth/register/route.ts
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validations/auth";
import { successResponse, errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validate input
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    const { username, password, customerName, customerAddress, customerPhone, customerEmail, taxId } =
      parsed.data;

    // Check duplicate username
    const existing = await prisma.customer.findUnique({ where: { username } });
    if (existing) {
      return errorResponse("Username นี้ถูกใช้งานแล้ว", 409);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create customer with PENDING status
    const customer = await prisma.customer.create({
      data: {
        username,
        password: hashedPassword,
        customerName,
        customerAddress,
        customerPhone,
        customerEmail: customerEmail || null,
        taxId: taxId || null,
        status: "PENDING",
      },
      select: {
        id: true,
        username: true,
        customerName: true,
        customerEmail: true,
        status: true,
        createdAt: true,
      },
    });

    return successResponse(
      {
        customer,
        message: "ลงทะเบียนสำเร็จ กรุณารอการอนุมัติจากเจ้าหน้าที่",
      },
      201
    );
  } catch (error) {
    console.error("[REGISTER_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดภายในระบบ", 500);
  }
}
