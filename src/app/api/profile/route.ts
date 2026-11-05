// src/app/api/profile/route.ts
// ลูกค้าดู/แก้ไขข้อมูลติดต่อของตัวเอง (ชื่อ ที่อยู่ เบอร์โทร อีเมล เลขผู้เสียภาษี)
// username และสถานะบัญชีแก้ไม่ได้จากหน้านี้
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuth } from "@/lib/api-auth";
import {
  successResponse,
  errorResponse,
  unauthorizedResponse,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-response";
import { updateProfileSchema } from "@/lib/validations/auth";

const PROFILE_SELECT = {
  id: true,
  username: true,
  customerName: true,
  customerAddress: true,
  customerPhone: true,
  customerEmail: true,
  taxId: true,
  status: true,
  createdAt: true,
} as const;

export async function GET(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "CUSTOMER") return forbiddenResponse("เฉพาะลูกค้าเท่านั้น");

  const customer = await prisma.customer.findUnique({ where: { id: auth.sub }, select: PROFILE_SELECT });
  if (!customer) return notFoundResponse("ไม่พบข้อมูลลูกค้า");
  return successResponse(customer);
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "CUSTOMER") return forbiddenResponse("เฉพาะลูกค้าเท่านั้น");

  const body = await req.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(parsed.error.errors[0].message, 422, parsed.error.flatten().fieldErrors);
  }
  const { customerName, customerAddress, customerPhone, customerEmail, taxId } = parsed.data;

  const current = await prisma.customer.findUnique({
    where: { id: auth.sub },
    select: { customerPhone: true, customerEmail: true },
  });
  if (!current) return notFoundResponse("ไม่พบข้อมูลลูกค้า");

  // อีเมล/เบอร์โทรใช้ login แทน username ได้ — ค่าที่ "เปลี่ยนใหม่" ห้ามซ้ำกับลูกค้าคนอื่น
  const changed = [
    ...(customerPhone !== current.customerPhone ? [{ customerPhone }] : []),
    ...(customerEmail && customerEmail !== current.customerEmail ? [{ customerEmail }] : []),
  ];
  const duplicate = changed.length
    ? await prisma.customer.findFirst({
        where: { id: { not: auth.sub }, OR: changed },
        select: { customerPhone: true, customerEmail: true },
      })
    : null;
  if (duplicate) {
    const phoneChanged = customerPhone !== current.customerPhone;
    const field = phoneChanged && duplicate.customerPhone === customerPhone ? "customerPhone" : "customerEmail";
    const message = field === "customerPhone" ? "เบอร์โทรนี้ถูกใช้กับบัญชีอื่นแล้ว" : "อีเมลนี้ถูกใช้กับบัญชีอื่นแล้ว";
    return errorResponse(message, 409, { [field]: [message] });
  }

  const updated = await prisma.customer.update({
    where: { id: auth.sub },
    data: {
      customerName,
      customerAddress,
      customerPhone,
      customerEmail: customerEmail || null,
      taxId: taxId || null,
    },
    select: PROFILE_SELECT,
  });

  return successResponse(updated, "บันทึกข้อมูลสำเร็จ");
}
