// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";

// หน้า login/register — เปิดให้คนที่ยังไม่ login เท่านั้น
const AUTH_PAGES = ["/login", "/register"];

// dashboard redirect ตาม role
const DASHBOARD: Record<string, string> = {
  CUSTOMER: "/dashboard",
  ADMIN: "/admin/dashboard",
  ACCOUNTANT: "/accountant/dashboard",
  TECHNICIAN: "/technician/dashboard",
  HEAD_TECHNICIAN: "/technician/dashboard",
};

// route prefix → roles ที่อนุญาต
const PROTECTED_ROUTES: Array<{ prefix: string; roles: string[] }> = [
  { prefix: "/dashboard", roles: ["CUSTOMER"] },
  { prefix: "/jobs", roles: ["CUSTOMER"] },
  { prefix: "/invoices", roles: ["CUSTOMER"] },
  { prefix: "/history", roles: ["CUSTOMER"] },
  { prefix: "/admin", roles: ["ADMIN"] },
  { prefix: "/accountant", roles: ["ACCOUNTANT"] },
  { prefix: "/technician", roles: ["TECHNICIAN", "HEAD_TECHNICIAN"] },
];

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // 1. Allow API routes — แต่ละ route จัดการ auth เอง
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 2. ตรวจ JWT จาก cookie (ต้องตรวจก่อนปล่อยหน้า login/register ไม่งั้นข้อ 4 จะไม่ทำงาน)
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  const payload = token ? await verifyToken(token) : null;
  const isAuthPage = AUTH_PAGES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // 3. ยังไม่ login (หรือ token หมดอายุ/ไม่ถูกต้อง)
  if (!payload) {
    // หน้า login/register เข้าได้เลย — ห้าม redirect ไป /login ซ้ำ ไม่งั้นจะวนลูป
    const response = isAuthPage
      ? NextResponse.next()
      : NextResponse.redirect(loginUrl(req, pathname === "/" ? null : pathname + search));
    if (token) response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // 4. ถ้าเข้า /, /login หรือ /register ทั้งที่ login แล้ว → redirect ไป dashboard
  if (pathname === "/" || isAuthPage) {
    return NextResponse.redirect(new URL(DASHBOARD[payload.role] ?? "/login", req.url));
  }

  // 5. ตรวจ role-based access
  for (const { prefix, roles } of PROTECTED_ROUTES) {
    if (pathname.startsWith(prefix)) {
      if (!roles.includes(payload.role)) {
        return NextResponse.redirect(new URL(DASHBOARD[payload.role] ?? "/login", req.url));
      }
      break;
    }
  }

  return NextResponse.next();
}

// /login?redirect=<หน้าเดิม> เพื่อให้ login แล้วกลับมาหน้าเดิมได้
function loginUrl(req: NextRequest, returnTo: string | null) {
  const url = new URL("/login", req.url);
  if (returnTo) url.searchParams.set("redirect", returnTo);
  return url;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)", "/"],
};
