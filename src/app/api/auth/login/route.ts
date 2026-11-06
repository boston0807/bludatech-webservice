// src/app/api/auth/login/route.ts
// UC01 เข้าสู่ระบบ — ลูกค้าใช้ username, อีเมล หรือเบอร์โทร / พนักงานใช้ username
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import type { Customer } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validations/auth";
import { signToken, AUTH_COOKIE_NAME, getAuthCookieOptions, type JWTPayload } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";
import { createRateLimiter, clientIp } from "@/lib/rate-limit";

const INVALID = "Username หรือรหัสผ่านไม่ถูกต้อง";

// กันเดารหัสผ่าน: ผิดเกิน 5 ครั้งต่อ username+IP หรือ 20 ครั้งต่อ IP ภายใน 15 นาที → พักการเข้าสู่ระบบ
const WINDOW_MS = 15 * 60 * 1000;
const perAccount = createRateLimiter({ limit: 5, windowMs: WINDOW_MS });
const perIp = createRateLimiter({ limit: 20, windowMs: WINDOW_MS });

function tooManyAttempts(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  const res = errorResponse(`เข้าสู่ระบบผิดหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${minutes} นาที`, 429);
  res.headers.set("Retry-After", String(seconds));
  return res;
}

const REDIRECT_BY_ROLE: Record<JWTPayload["role"], string> = {
  CUSTOMER: "/dashboard",
  ADMIN: "/admin/dashboard",
  ACCOUNTANT: "/accountant/dashboard",
  TECHNICIAN: "/technician/dashboard",
  HEAD_TECHNICIAN: "/technician/dashboard",
};

async function loginResponse(payload: JWTPayload) {
  const token = await signToken(payload);
  const response = NextResponse.json({
    success: true,
    data: {
      user: { id: payload.sub, username: payload.username, name: payload.name, role: payload.role },
      redirectTo: REDIRECT_BY_ROLE[payload.role] ?? "/dashboard",
    },
  });
  response.cookies.set(AUTH_COOKIE_NAME, token, getAuthCookieOptions());
  return response;
}

function customerStatusError(customer: Customer, passwordValid: boolean) {
  if (customer.status === "PENDING") {
    return errorResponse("บัญชีของคุณยังรอการอนุมัติจากเจ้าหน้าที่", 403);
  }
  // ไม่บอกเหตุผลก่อนยืนยันรหัสผ่าน กันคนอื่นเดา username แล้วเห็นข้อมูล
  return errorResponse(
    "บัญชีของคุณยังไม่ผ่านการอนุมัติ กรุณาแก้ไขข้อมูลและส่งใหม่",
    403,
    passwordValid
      ? { code: "CUSTOMER_REJECTED", rejectNote: customer.rejectNote, resubmitUrl: "/register/resubmit" }
      : { code: "CUSTOMER_REJECTED", resubmitUrl: "/register/resubmit" }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
    }

    const username = parsed.data.username.trim();
    const { password } = parsed.data;

    const ip = clientIp(req.headers);
    const accountKey = `login:${username.toLowerCase()}:${ip}`;
    const ipKey = `login-ip:${ip}`;
    const wait = Math.max(perAccount.blockedFor(accountKey), perIp.blockedFor(ipKey));
    if (wait > 0) return tooManyAttempts(wait);
    const fail = (res: Response) => {
      perAccount.hit(accountKey);
      perIp.hit(ipKey);
      return res;
    };
    const succeed = <T>(res: T) => {
      perAccount.reset(accountKey);
      return res;
    };

    // ลูกค้าและพนักงานอยู่คนละตาราง username อาจซ้ำกันได้ จึงต้องเทียบรหัสผ่านก่อนตัดสินว่าเป็นใคร
    // (เดิมเจอลูกค้าก่อนแล้วจบเลย → ลูกค้าที่สมัครด้วย username ของพนักงานทำให้พนักงานเข้าระบบไม่ได้)
    const [customerByUsername, employee] = await Promise.all([
      prisma.customer.findUnique({ where: { username } }),
      prisma.employee.findUnique({ where: { username } }),
    ]);

    let customer = customerByUsername;
    let customerPasswordValid = customer ? await bcrypt.compare(password, customer.password) : false;

    // UC01 ข้อ 2: ลูกค้ากรอกอีเมลหรือเบอร์โทรแทน username ได้
    if (!customer && !employee) {
      const candidates = await prisma.customer.findMany({
        where: { OR: [{ customerEmail: username }, { customerPhone: username }] },
        take: 5,
      });
      for (const c of candidates) {
        if (await bcrypt.compare(password, c.password)) {
          customer = c;
          customerPasswordValid = true;
          break;
        }
      }
      if (!customer && candidates.length === 1) customer = candidates[0];
    }

    if (customer && customerPasswordValid) {
      if (customer.status !== "ACTIVE") return succeed(customerStatusError(customer, true));
      return succeed(await loginResponse({
        sub: customer.id,
        username: customer.username,
        role: "CUSTOMER",
        name: customer.customerName,
      }));
    }

    if (employee && (await bcrypt.compare(password, employee.password))) {
      return succeed(await loginResponse({
        sub: employee.id,
        username: employee.username,
        role: employee.role,
        name: employee.employeeName,
      }));
    }

    // รหัสผ่านผิด: ถ้าเป็นบัญชีลูกค้าที่ยังไม่อนุมัติ แจ้งสถานะ (ไม่เปิดเผยเหตุผล) เหมือนเดิม
    if (customer && !employee && customer.status !== "ACTIVE") {
      return fail(customerStatusError(customer, false));
    }

    return fail(errorResponse(INVALID, 401));
  } catch (error) {
    console.error("[LOGIN_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดภายในระบบ", 500);
  }
}
