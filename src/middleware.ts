// src/middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";

// Public paths ที่ไม่ต้องการ auth
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
];

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
  const { pathname } = req.nextUrl;

  // 1. Allow static files และ public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // 2. Allow API routes — แต่ละ route จัดการ auth เอง
  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  // 3. Protected page routes — ตรวจ JWT จาก cookie
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    const url = new URL("/login", req.url);
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  const payload = await verifyToken(token);

  if (!payload) {
    const response = NextResponse.redirect(new URL("/login", req.url));
    response.cookies.delete(AUTH_COOKIE_NAME);
    return response;
  }

  // 4. ถ้าเข้า /login หรือ /register ทั้งที่ login แล้ว → redirect ไป dashboard
  if (pathname === "/" || pathname === "/login" || pathname === "/register") {
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public/).*)", "/"],
};
