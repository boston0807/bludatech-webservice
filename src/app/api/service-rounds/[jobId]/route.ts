// src/app/api/service-rounds/[jobId]/route.ts
// POST — ธุรการสร้างใบงานรอบบำรุงประจำเดือนจากสัญญาบำรุง แล้วเลื่อนกำหนดรอบถัดไปอีก 1 เดือน
// (ปกติ Cron สร้างให้อัตโนมัติก่อนถึงกำหนด — ปุ่มนี้ใช้สร้างล่วงหน้าหรือกรณี Cron พลาด)
import { NextRequest } from "next/server";
import { getAuth } from "@/lib/api-auth";
import { ApiError, successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { createServiceRound } from "@/lib/service-rounds";

type Params = { params: Promise<{ jobId: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await getAuth(req);
  if (!auth) return unauthorizedResponse();
  if (auth.role !== "ADMIN") return forbiddenResponse("เฉพาะธุรการที่สร้างใบงานรอบบำรุงได้");

  const { jobId } = await params;
  try {
    const { roundJob, roundNumber } = await createServiceRound(jobId, { automatic: false });
    return successResponse(roundJob, `สร้างใบงานรอบบำรุงครั้งที่ ${roundNumber} และแจ้งลูกค้าแล้ว`);
  } catch (error) {
    if (error instanceof ApiError) return errorResponse(error.message, error.status);
    console.error("[CREATE_SERVICE_ROUND_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการสร้างใบงานรอบบำรุง", 500);
  }
}
