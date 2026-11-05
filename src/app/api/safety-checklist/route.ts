// src/app/api/safety-checklist/route.ts — รายการตรวจความปลอดภัยมาตรฐาน (UC13)
import { NextRequest } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { successResponse, unauthorizedResponse } from "@/lib/api-response";
import { SAFETY_CHECKLIST } from "@/lib/safety-checklist";

export async function GET(req: NextRequest) {
  if (!(await getAuth(req))) return unauthorizedResponse();
  return successResponse(SAFETY_CHECKLIST);
}
