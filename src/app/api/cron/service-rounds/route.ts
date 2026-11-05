// src/app/api/cron/service-rounds/route.ts
// เรียกโดย Cloudflare Cron Trigger (ดู custom-worker.ts) วันละครั้ง
// สร้างใบงานรอบบำรุงของสัญญาที่จะถึงกำหนดภายใน SERVICE_AUTO_CREATE_DAYS วัน แล้วแจ้งธุรการ/ช่าง/ลูกค้า
//
// ยิงเองได้ (เช่นตอนทดสอบ): curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/cron/service-rounds
import { NextRequest } from "next/server";
import { ApiError, successResponse, errorResponse } from "@/lib/api-response";
import { createServiceRound, findDueContracts, SERVICE_AUTO_CREATE_DAYS } from "@/lib/service-rounds";

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[CRON] CRON_SECRET is not set — refusing to run");
    return errorResponse("Cron ยังไม่ได้ตั้งค่า", 503);
  }
  const header = req.headers.get("authorization") ?? "";
  if (!constantTimeEqual(header, `Bearer ${secret}`)) return errorResponse("Unauthorized", 401);

  const due = await findDueContracts(SERVICE_AUTO_CREATE_DAYS);
  const created: { contractJobId: string; roundJobId: string; roundNumber: number }[] = [];
  const skipped: { contractJobId: string; reason: string }[] = [];

  // ทีละสัญญา: สัญญาหนึ่งพังต้องไม่ทำให้สัญญาอื่นไม่ถูกสร้าง
  for (const { id } of due) {
    try {
      const { roundJob, roundNumber } = await createServiceRound(id, { automatic: true });
      created.push({ contractJobId: id, roundJobId: roundJob.id, roundNumber });
    } catch (error) {
      const reason = error instanceof ApiError ? error.message : "unexpected error";
      if (!(error instanceof ApiError)) console.error("[CRON_SERVICE_ROUND_ERROR]", id, error);
      skipped.push({ contractJobId: id, reason });
    }
  }

  console.log(`[CRON] service-rounds: ${created.length} created, ${skipped.length} skipped`);
  return successResponse({ checked: due.length, created, skipped });
}
