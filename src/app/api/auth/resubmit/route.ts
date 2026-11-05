// src/app/api/auth/resubmit/route.ts
// BP ข้อ 5 → 4: ลูกค้าที่ธุรการไม่อนุมัติ แก้ไขข้อมูลตามเหตุผลแล้วส่งให้ตรวจสอบใหม่
//   { mode: "verify", username, password }        → ยืนยันตัวตน คืนข้อมูลเดิม + เหตุผลที่ไม่อนุมัติ
//   { mode: "submit", username, password, ...ข้อมูลใหม่ } → บันทึกข้อมูลใหม่ สถานะกลับเป็น PENDING
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { resubmitSchema } from "@/lib/validations/auth";
import { successResponse, errorResponse } from "@/lib/api-response";
import { Notify } from "@/lib/notifications";

const INVALID = "Username หรือรหัสผ่านไม่ถูกต้อง";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const mode = body?.mode === "submit" ? "submit" : "verify";
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || !password) return errorResponse("กรุณากรอก Username และรหัสผ่าน", 422);

  const customer = await prisma.customer.findUnique({ where: { username } });
  // ไม่แยกข้อความ "ไม่พบผู้ใช้" กับ "รหัสผิด" กันการเดา username
  if (!customer || !(await bcrypt.compare(password, customer.password))) {
    return errorResponse(INVALID, 401);
  }
  if (customer.status !== "REJECTED") {
    return errorResponse(
      customer.status === "PENDING"
        ? "ข้อมูลของคุณอยู่ระหว่างรอการอนุมัติจากเจ้าหน้าที่"
        : "บัญชีของคุณได้รับการอนุมัติแล้ว สามารถเข้าสู่ระบบได้ทันที",
      409
    );
  }

  if (mode === "verify") {
    return successResponse({
      username: customer.username,
      customerName: customer.customerName,
      customerAddress: customer.customerAddress,
      customerPhone: customer.customerPhone,
      customerEmail: customer.customerEmail ?? "",
      taxId: customer.taxId ?? "",
      rejectNote: customer.rejectNote,
    });
  }

  const parsed = resubmitSchema.safeParse({ ...body, username });
  if (!parsed.success) {
    return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  }
  const { customerName, customerAddress, customerPhone, customerEmail, taxId } = parsed.data;

  const changed = await prisma.customer.updateMany({
    where: { id: customer.id, status: "REJECTED" },
    // เก็บ rejectNote ไว้ให้ธุรการเห็นว่ารอบก่อนไม่อนุมัติเพราะอะไร (ล้างเมื่ออนุมัติ)
    data: {
      customerName,
      customerAddress,
      customerPhone,
      customerEmail: customerEmail || null,
      taxId: taxId || null,
      status: "PENDING",
    },
  });
  if (changed.count === 0) return errorResponse("สถานะบัญชีเปลี่ยนไปแล้ว กรุณาลองใหม่", 409);

  await Notify.customerRegistered({ customerName, resubmitted: true });

  return successResponse({ message: "ส่งข้อมูลให้เจ้าหน้าที่ตรวจสอบอีกครั้งแล้ว กรุณารอการอนุมัติ" });
}
