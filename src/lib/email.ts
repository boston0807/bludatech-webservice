// src/lib/email.ts
// Gmail SMTP notification helper — ใช้ nodemailer + Gmail App Password
// Env vars required: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

import nodemailer from "nodemailer";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// ─────────────────────────────────────────────
// Transport (singleton)
// ─────────────────────────────────────────────

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === "true", // false = STARTTLS (port 587), true = SSL (port 465)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

const FROM = process.env.SMTP_FROM ?? "Bludatech Service <no-reply@example.com>";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─────────────────────────────────────────────
// Shared mail sender
// ─────────────────────────────────────────────

async function deliver(to: string, subject: string, html: string): Promise<void> {
  const transporter = createTransport();
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
  } catch (err) {
    // ล็อก error แต่ไม่ throw — ไม่ให้ email failure พัง API response
    console.error(`[EMAIL] Failed to send to ${to}:`, err);
  }
}

export function sendMail(to: string, subject: string, html: string): Promise<void> {
  // ถ้าไม่มี SMTP_USER หรือ SMTP_PASS ข้ามการส่ง (dev mode)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[EMAIL] SMTP not configured — skipping email to ${to}: ${subject}`);
    return Promise.resolve();
  }

  const task = deliver(to, subject, html);
  // API route เรียกแบบ fire-and-forget (ไม่ await) — บน Cloudflare Workers งานที่ค้างอยู่
  // จะถูกตัดทิ้งเมื่อส่ง response แล้ว จึงต้องฝากไว้กับ ctx.waitUntil ให้ส่งจนเสร็จ
  try {
    getCloudflareContext().ctx.waitUntil(task);
  } catch {
    // ไม่ได้รันบน Workers (next dev / Node.js) — promise ทำงานต่อเองได้
  }
  return task;
}

// ─────────────────────────────────────────────
// Email template base
// ─────────────────────────────────────────────

export function baseTemplate(title: string, body: string): string {
  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
          <!-- Header -->
          <tr>
            <td style="background:#1d4ed8;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">🛗 Bludatech Service</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:18px;">${title}</h2>
              ${body}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#6b7280;font-size:12px;">
                อีเมลนี้ส่งโดยระบบอัตโนมัติ กรุณาอย่าตอบกลับ<br/>
                © ${new Date().getFullYear()} Bludatech Service Management System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">${label}</a>`;
}

export function infoRow(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#6b7280;font-size:14px;width:160px;">${label}</td>
    <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${value}</td>
  </tr>`;
}

// ─────────────────────────────────────────────
// UC03 — Admin อนุมัติ / ปฏิเสธ ลูกค้า
// ─────────────────────────────────────────────

export async function sendCustomerApprovalEmail(params: {
  to: string;
  customerName: string;
  action: "APPROVE" | "REJECT";
  rejectNote?: string | null;
}): Promise<void> {
  const { to, customerName, action, rejectNote } = params;

  if (action === "APPROVE") {
    const subject = "✅ บัญชีของคุณได้รับการอนุมัติแล้ว — Bludatech Service";
    const html = baseTemplate("บัญชีของคุณได้รับการอนุมัติแล้ว", `
      <p style="color:#374151;font-size:14px;line-height:1.6;">เรียนคุณ <strong>${customerName}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;">
        บัญชีของคุณในระบบ <strong>Bludatech Service</strong> ได้รับการอนุมัติเรียบร้อยแล้ว
        คุณสามารถเข้าสู่ระบบและยื่นคำขอบริการได้ทันที
      </p>
      ${btn(`${APP_URL}/login`, "เข้าสู่ระบบ")}
    `);
    await sendMail(to, subject, html);
  } else {
    const subject = "❌ คำขอสมัครสมาชิกของคุณไม่ได้รับการอนุมัติ — Bludatech Service";
    const html = baseTemplate("คำขอสมัครสมาชิกไม่ได้รับการอนุมัติ", `
      <p style="color:#374151;font-size:14px;line-height:1.6;">เรียนคุณ <strong>${customerName}</strong>,</p>
      <p style="color:#374151;font-size:14px;line-height:1.6;">
        ขออภัย คำขอสมัครสมาชิกของคุณยังไม่ได้รับการอนุมัติ
        กรุณาแก้ไขข้อมูลตามเหตุผลด้านล่างแล้วส่งคำขอใหม่อีกครั้ง
      </p>
      ${rejectNote ? `<table cellpadding="0" cellspacing="0" style="margin-top:16px;">${infoRow("เหตุผล", rejectNote)}</table>` : ""}
      ${btn(`${APP_URL}/register/resubmit`, "แก้ไขข้อมูลและส่งใหม่")}
    `);
    await sendMail(to, subject, html);
  }
}

// ─────────────────────────────────────────────
// UC06 — ใบเสนอราคาถูกสร้างแล้ว
// ─────────────────────────────────────────────

export async function sendQuotationCreatedEmail(params: {
  to: string;
  customerName: string;
  jobId: string;
  totalAmount: number | string;
}): Promise<void> {
  const { to, customerName, jobId, totalAmount } = params;
  const subject = "📄 ใบเสนอราคาของคุณพร้อมแล้ว — Bludatech Service";
  const html = baseTemplate("ใบเสนอราคาของคุณพร้อมแล้ว", `
    <p style="color:#374151;font-size:14px;line-height:1.6;">เรียนคุณ <strong>${customerName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      ใบเสนอราคาสำหรับงานบริการของคุณพร้อมแล้ว กรุณาตรวจสอบและอนุมัติหรือปฏิเสธใบเสนอราคา
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow("หมายเลขใบงาน", jobId)}
      ${infoRow("ยอดรวม", `${Number(totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`)}
    </table>
    ${btn(`${APP_URL}/jobs/${jobId}`, "ดูใบเสนอราคา")}
  `);
  await sendMail(to, subject, html);
}

// ─────────────────────────────────────────────
// UC13 — งานเสร็จแล้ว รอการตรวจรับ
// ─────────────────────────────────────────────

export async function sendWaitingAcceptanceEmail(params: {
  to: string;
  customerName: string;
  jobId: string;
}): Promise<void> {
  const { to, customerName, jobId } = params;
  const subject = "🔔 งานของคุณพร้อมรับการตรวจ — Bludatech Service";
  const html = baseTemplate("งานของคุณพร้อมรับการตรวจแล้ว", `
    <p style="color:#374151;font-size:14px;line-height:1.6;">เรียนคุณ <strong>${customerName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      งานบริการลิฟต์ของคุณดำเนินการเสร็จสิ้นและผ่านการทดสอบความปลอดภัยแล้ว
      กรุณาตรวจสอบและยืนยันรับงาน
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow("หมายเลขใบงาน", jobId)}
      ${infoRow("สถานะ", "รอการตรวจรับ")}
    </table>
    ${btn(`${APP_URL}/jobs/${jobId}`, "ตรวจรับงาน")}
  `);
  await sendMail(to, subject, html);
}

// ─────────────────────────────────────────────
// UC15 — ออกใบแจ้งหนี้แล้ว
// ─────────────────────────────────────────────

export async function sendInvoiceIssuedEmail(params: {
  to: string;
  customerName: string;
  jobId: string;
  invoiceId: string;
  totalAmount: number | string;
}): Promise<void> {
  const { to, customerName, jobId, invoiceId, totalAmount } = params;
  const subject = "🧾 ใบแจ้งหนี้ของคุณพร้อมแล้ว — Bludatech Service";
  const html = baseTemplate("ใบแจ้งหนี้ของคุณพร้อมแล้ว", `
    <p style="color:#374151;font-size:14px;line-height:1.6;">เรียนคุณ <strong>${customerName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      ใบแจ้งหนี้สำหรับงานบริการลิฟต์ของคุณได้ออกเรียบร้อยแล้ว กรุณาชำระเงินภายในกำหนด
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow("หมายเลขใบงาน", jobId)}
      ${infoRow("หมายเลขใบแจ้งหนี้", invoiceId)}
      ${infoRow("ยอดที่ต้องชำระ", `${Number(totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท`)}
      ${infoRow("สถานะ", "รอชำระเงิน")}
    </table>
    ${btn(`${APP_URL}/invoices`, "ชำระเงิน")}
  `);
  await sendMail(to, subject, html);
}

// ─────────────────────────────────────────────
// UC08 — ช่างสร้างแผนงานแล้ว (แจ้งกำหนดการเข้าดำเนินงาน)
// ─────────────────────────────────────────────

export async function sendWorkPlanCreatedEmail(params: {
  to: string;
  customerName: string;
  jobId: string;
  location: string;
  startDate: Date;
  endDate: Date;
}): Promise<void> {
  const { to, customerName, jobId, location, startDate, endDate } = params;
  const fmt = (d: Date) =>
    d.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Bangkok" });
  const subject = "🗓️ กำหนดการเข้าดำเนินงานของคุณ — Bludatech Service";
  const html = baseTemplate("แผนงานของคุณถูกจัดทำแล้ว", `
    <p style="color:#374151;font-size:14px;line-height:1.6;">เรียนคุณ <strong>${customerName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      ทีมช่างได้จัดทำแผนงานสำหรับงานบริการลิฟต์ของคุณเรียบร้อยแล้ว โดยมีกำหนดการดังนี้
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow("หมายเลขใบงาน", jobId)}
      ${infoRow("สถานที่", location)}
      ${infoRow("วันที่เริ่มงาน", fmt(startDate))}
      ${infoRow("วันที่สิ้นสุด", fmt(endDate))}
    </table>
    ${btn(`${APP_URL}/jobs/${jobId}`, "ดูรายละเอียดงาน")}
  `);
  await sendMail(to, subject, html);
}

// ─────────────────────────────────────────────
// BP ข้อ 19 — แจ้งเตือนรอบบำรุงรักษาประจำเดือน
// ─────────────────────────────────────────────

export async function sendServiceRoundEmail(params: {
  to: string;
  customerName: string;
  jobId: string;
  roundNumber: number;
  dueDate: Date;
  jobAddress: string;
}): Promise<void> {
  const { to, customerName, jobId, roundNumber, dueDate, jobAddress } = params;
  const due = dueDate.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric", timeZone: "Asia/Bangkok" });
  const subject = `🔧 ถึงกำหนดบำรุงรักษาลิฟต์ประจำเดือน (ครั้งที่ ${roundNumber}) — Bludatech Service`;
  const html = baseTemplate("ถึงกำหนดบำรุงรักษาลิฟต์ประจำเดือน", `
    <p style="color:#374151;font-size:14px;line-height:1.6;">เรียนคุณ <strong>${customerName}</strong>,</p>
    <p style="color:#374151;font-size:14px;line-height:1.6;">
      ลิฟต์ของคุณถึงกำหนดบำรุงรักษาตามสัญญา ระบบได้สร้างใบงานรอบนี้ให้เรียบร้อยแล้ว
      ทีมช่างจะติดต่อเพื่อนัดหมายวันเข้าดำเนินงาน
    </p>
    <table cellpadding="0" cellspacing="0" style="margin-top:16px;">
      ${infoRow("หมายเลขใบงาน", jobId)}
      ${infoRow("รอบบำรุงครั้งที่", String(roundNumber))}
      ${infoRow("กำหนดบำรุง", due)}
      ${infoRow("สถานที่", jobAddress)}
    </table>
    ${btn(`${APP_URL}/jobs/${jobId}`, "ดูใบงาน")}
  `);
  await sendMail(to, subject, html);
}
