// src/lib/email-notifications.ts
// อีเมลแจ้งเตือนเพิ่มเติม (แผนงาน, ตรวจรับไม่ผ่าน, ใบเสร็จ, เตือนรอบบำรุงล่วงหน้า)
// ใช้ template/ตัวส่งเดียวกับ src/lib/email.ts

import { sendMail, baseTemplate, btn, infoRow, APP_URL } from "@/lib/email";

// ─────────────────────────────────────────────
// ผู้รับฝั่งพนักงาน — ตาราง Employee ไม่มีอีเมล จึงตั้งผ่าน env (คั่นด้วย ,)
//   TECH_NOTIFY_EMAILS  = ทีมช่าง/หัวหน้าช่าง (แผนงานถูกอนุมัติ/ตีกลับ, ลูกค้าตรวจรับไม่ผ่าน)
//   STAFF_NOTIFY_EMAILS = ใช้แทนเมื่อไม่ได้ตั้ง TECH_NOTIFY_EMAILS
// ─────────────────────────────────────────────

function staffRecipients(): string[] {
  const raw = process.env.TECH_NOTIFY_EMAILS || process.env.STAFF_NOTIFY_EMAILS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s));
}

/** ข้อความที่ผู้ใช้พิมพ์เอง ต้อง escape ก่อนใส่ใน HTML */
function esc(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const thLong = (d: Date) =>
  d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Bangkok" });

const money = (n: number | string) =>
  `${Number(n).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;

const PAYMENT_METHOD_TH: Record<string, string> = {
  TRANSFER: "โอนเงินผ่านธนาคาร",
  CASH: "เงินสด",
  CREDIT_CARD: "บัตรเครดิต",
};

const p = (html: string) => `<p style="color:#374151;font-size:14px;line-height:1.6;">${html}</p>`;
const table = (rows: string) => `<table cellpadding="0" cellspacing="0" style="margin-top:16px;">${rows}</table>`;

// ─────────────────────────────────────────────
// UC09 — ลูกค้าอนุมัติ / ขอให้ปรับแผนงาน
//   แจ้งลูกค้า (ยืนยันผล) + แจ้งทีมช่าง (ถ้าตั้ง env ไว้)
// ─────────────────────────────────────────────

export async function sendWorkPlanDecisionEmail(params: {
  customerEmail?: string | null;
  customerName: string;
  jobId: string;
  jobAddress: string;
  action: "APPROVE" | "REJECT";
  startDate: Date;
  endDate: Date;
  rejectNote?: string | null;
}): Promise<void> {
  const { customerEmail, customerName, jobId, jobAddress, action, startDate, endDate, rejectNote } = params;
  const approved = action === "APPROVE";
  const rows =
    infoRow("หมายเลขใบงาน", esc(jobId)) +
    infoRow("สถานที่", esc(jobAddress)) +
    infoRow("กำหนดการ", `${thLong(startDate)} – ${thLong(endDate)}`) +
    (!approved && rejectNote ? infoRow("สิ่งที่ขอให้ปรับ", esc(rejectNote)) : "");

  const tasks: Promise<void>[] = [];

  if (customerEmail) {
    const subject = approved
      ? "✅ ยืนยันการอนุมัติแผนงาน — Bludatech Service"
      : "📝 ได้รับคำขอปรับแผนงานของคุณแล้ว — Bludatech Service";
    const html = baseTemplate(
      approved ? "คุณอนุมัติแผนงานเรียบร้อยแล้ว" : "ได้รับคำขอปรับแผนงานแล้ว",
      p(`เรียนคุณ <strong>${esc(customerName)}</strong>,`) +
        p(
          approved
            ? "ระบบบันทึกการอนุมัติแผนงานของคุณแล้ว ทีมช่างจะเข้าปฏิบัติงานตามกำหนดการด้านล่าง"
            : "ทีมช่างได้รับคำขอปรับแผนของคุณแล้ว และจะส่งแผนที่ปรับปรุงให้คุณพิจารณาอีกครั้ง"
        ) +
        table(rows) +
        btn(`${APP_URL}/jobs/${encodeURIComponent(jobId)}`, "ดูรายละเอียดงาน")
    );
    tasks.push(sendMail(customerEmail, subject, html));
  }

  for (const to of staffRecipients()) {
    const subject = approved
      ? `✅ ลูกค้าอนุมัติแผนงานแล้ว — ${customerName}`
      : `⚠️ ลูกค้าขอให้ปรับแผนงาน — ${customerName}`;
    const html = baseTemplate(
      approved ? "ลูกค้าอนุมัติแผนงานแล้ว" : "ลูกค้าขอให้ปรับแผนงาน",
      p(
        `ลูกค้า <strong>${esc(customerName)}</strong> ` +
          (approved ? "อนุมัติแผนงานแล้ว เตรียมเข้าปฏิบัติงานตามกำหนด" : "ไม่อนุมัติแผนงาน กรุณาปรับแผนแล้วส่งใหม่")
      ) +
        table(rows) +
        btn(`${APP_URL}/technician/workplans`, "ไปหน้าแผนงาน")
    );
    tasks.push(sendMail(to, subject, html));
  }

  await Promise.all(tasks);
}

// ─────────────────────────────────────────────
// UC14 — ลูกค้าตรวจรับงานไม่ผ่าน → แจ้งทีมช่างพร้อมสิ่งที่ต้องแก้ไข
// ─────────────────────────────────────────────

export async function sendReworkRequestedEmail(params: {
  customerName: string;
  jobId: string;
  jobAddress: string;
  reworkNote: string;
}): Promise<void> {
  const { customerName, jobId, jobAddress, reworkNote } = params;
  const recipients = staffRecipients();
  if (recipients.length === 0) {
    console.warn("[EMAIL] TECH_NOTIFY_EMAILS/STAFF_NOTIFY_EMAILS not set — skipping rework notification");
    return;
  }
  const subject = `🔁 ลูกค้าตรวจรับงานไม่ผ่าน ต้องแก้ไข — ${customerName}`;
  const html = baseTemplate(
    "ลูกค้าตรวจรับงานไม่ผ่าน",
    p(`ลูกค้า <strong>${esc(customerName)}</strong> ส่งงานกลับให้แก้ไข กรุณาดำเนินการแล้วทดสอบความปลอดภัยใหม่`) +
      table(
        infoRow("หมายเลขใบงาน", esc(jobId)) +
          infoRow("สถานที่", esc(jobAddress)) +
          infoRow("สิ่งที่ต้องแก้ไข", esc(reworkNote))
      ) +
      btn(`${APP_URL}/technician/workplans`, "ไปหน้าแผนงาน")
  );
  await Promise.all(recipients.map((to) => sendMail(to, subject, html)));
}

// ─────────────────────────────────────────────
// UC16 — ชำระเงินสำเร็จ (ใบเสร็จรับเงิน)
// ─────────────────────────────────────────────

export async function sendPaymentReceiptEmail(params: {
  to: string;
  customerName: string;
  jobId: string;
  receiptId: string;
  amount: number | string;
  paymentMethod: string;
  paymentDate: Date;
}): Promise<void> {
  const { to, customerName, jobId, receiptId, amount, paymentMethod, paymentDate } = params;
  const subject = "🧾 ใบเสร็จรับเงิน — ได้รับชำระเงินเรียบร้อยแล้ว — Bludatech Service";
  const html = baseTemplate(
    "ได้รับชำระเงินเรียบร้อยแล้ว",
    p(`เรียนคุณ <strong>${esc(customerName)}</strong>,`) +
      p("ขอบคุณที่ชำระค่าบริการ ระบบได้รับชำระเงินของคุณเรียบร้อยแล้ว รายละเอียดใบเสร็จมีดังนี้") +
      table(
        infoRow("เลขที่ใบเสร็จ", esc(receiptId)) +
          infoRow("หมายเลขใบงาน", esc(jobId)) +
          infoRow("จำนวนเงิน", money(amount)) +
          infoRow("วิธีชำระ", PAYMENT_METHOD_TH[paymentMethod] ?? esc(paymentMethod)) +
          infoRow("วันที่ชำระ", thLong(paymentDate))
      ) +
      btn(`${APP_URL}/jobs/${encodeURIComponent(jobId)}/invoice`, "ดู / พิมพ์ใบเสร็จ")
  );
  await sendMail(to, subject, html);
}

// ─────────────────────────────────────────────
// BP ข้อ 19 — เตือนล่วงหน้าก่อนถึงรอบบำรุง (เรียกจาก cron รายวัน)
// ─────────────────────────────────────────────

export async function sendServiceDueReminderEmail(params: {
  to: string;
  customerName: string;
  contractJobId: string;
  jobAddress: string;
  dueDate: Date;
  daysLeft: number;
}): Promise<void> {
  const { to, customerName, contractJobId, jobAddress, dueDate, daysLeft } = params;
  const subject = `⏰ อีก ${daysLeft} วันถึงกำหนดบำรุงรักษาลิฟต์ — Bludatech Service`;
  const html = baseTemplate(
    "ใกล้ถึงกำหนดบำรุงรักษาลิฟต์",
    p(`เรียนคุณ <strong>${esc(customerName)}</strong>,`) +
      p(
        `ลิฟต์ของคุณจะถึงกำหนดบำรุงรักษาตามสัญญาในอีก <strong>${daysLeft} วัน</strong> ทีมงานจะติดต่อเพื่อนัดหมายวันเข้าดำเนินงาน`
      ) +
      table(
        infoRow("สัญญาบำรุง (ใบงาน)", esc(contractJobId)) +
          infoRow("สถานที่", esc(jobAddress)) +
          infoRow("กำหนดบำรุง", thLong(dueDate))
      ) +
      btn(`${APP_URL}/dashboard`, "ดูกำหนดการ")
  );
  await sendMail(to, subject, html);
}
