// src/app/api/cron/service-reminders/route.ts
// BP ข้อ 19 — เตือนลูกค้าล่วงหน้าก่อนถึงรอบบำรุงรักษา (เรียกวันละครั้งจาก Cloudflare Cron Trigger)
//   ส่งเฉพาะสัญญาที่ "เหลืออีก N วันพอดี" (ค่าเริ่มต้น 7 วัน) จึงส่งครั้งเดียวต่อรอบ
//   โดยไม่ต้องเก็บสถานะการส่งในฐานข้อมูล
// ป้องกันด้วย header  Authorization: Bearer <CRON_SECRET>
//   ?dryRun=1  ดูรายการที่จะส่งโดยไม่ส่งจริง
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { successResponse, errorResponse, unauthorizedResponse } from "@/lib/api-response";
import { daysUntil } from "@/lib/dates";
import { sendServiceDueReminderEmail } from "@/lib/email-notifications";

function noticeDays(): number {
  const n = Number(process.env.SERVICE_DUE_NOTICE_DAYS ?? 7);
  return Number.isInteger(n) && n > 0 && n <= 60 ? n : 7;
}

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (token.length !== secret.length) return false;
  // เทียบแบบเวลาคงที่
  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

async function run(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return errorResponse("ยังไม่ได้ตั้งค่า CRON_SECRET", 503);
  }
  if (!authorized(req)) return unauthorizedResponse("cron token ไม่ถูกต้อง");

  const dryRun = new URL(req.url).searchParams.get("dryRun") === "1";
  const days = noticeDays();
  const now = new Date();

  const contracts = await prisma.job.findMany({
    where: {
      jobType: "SERVICE",
      parentJobId: null,
      status: "COMPLETED",
      service: { nextServiceDate: { not: null } },
    },
    select: {
      id: true,
      jobAddress: true,
      customer: { select: { customerName: true, customerEmail: true } },
      service: { select: { nextServiceDate: true, endServiceDate: true } },
    },
  });

  const due = contracts.filter((c) => {
    const next = c.service?.nextServiceDate;
    if (!next) return false;
    const end = c.service?.endServiceDate;
    if (end && next > end) return false; // เลยอายุสัญญาแล้ว
    return daysUntil(next, now) === days;
  });

  const results: { contractJobId: string; customerName: string; sent: boolean; reason?: string }[] = [];
  for (const c of due) {
    if (!c.customer.customerEmail) {
      results.push({ contractJobId: c.id, customerName: c.customer.customerName, sent: false, reason: "ไม่มีอีเมล" });
      continue;
    }
    if (!dryRun) {
      await sendServiceDueReminderEmail({
        to: c.customer.customerEmail,
        customerName: c.customer.customerName,
        contractJobId: c.id,
        jobAddress: c.jobAddress,
        dueDate: c.service!.nextServiceDate!,
        daysLeft: days,
      });
    }
    results.push({ contractJobId: c.id, customerName: c.customer.customerName, sent: !dryRun });
  }

  return successResponse({ noticeDays: days, dryRun, checked: contracts.length, due: results });
}

export const GET = run;
export const POST = run;
