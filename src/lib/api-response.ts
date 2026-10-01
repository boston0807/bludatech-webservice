// src/lib/api-response.ts
import { NextResponse } from "next/server";

export function successResponse<T>(data: T, messageOrStatus: string | number = 200) {
  const status = typeof messageOrStatus === "number" ? messageOrStatus : 200;
  const message = typeof messageOrStatus === "string" ? messageOrStatus : undefined;
  return NextResponse.json({ success: true, data, ...(message ? { message } : {}) }, { status });
}

export function errorResponse(message: string, status = 400, errors?: unknown) {
  return NextResponse.json(
    { success: false, message, ...(errors ? { errors } : {}) },
    { status }
  );
}

export function unauthorizedResponse(message = "กรุณาเข้าสู่ระบบ") {
  return errorResponse(message, 401);
}

export function forbiddenResponse(message = "คุณไม่มีสิทธิ์เข้าถึงส่วนนี้") {
  return errorResponse(message, 403);
}

export function notFoundResponse(message = "ไม่พบข้อมูล") {
  return errorResponse(message, 404);
}
