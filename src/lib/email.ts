// src/lib/email.ts
// Gmail SMTP notification helper — ใช้ nodemailer + Gmail App Password
// Env vars required: SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM

import nodemailer from "nodemailer";

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
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

// ─────────────────────────────────────────────
// Shared mail sender
// ─────────────────────────────────────────────

async function sendMail(to: string, subject: string, html: string): Promise<void> {
  // ถ้าไม่มี SMTP_USER หรือ SMTP_PASS ข้ามการส่ง (dev mode)
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[EMAIL] SMTP not configured — skipping email to ${to}: ${subject}`);
    return;
  }

  const transporter = createTransport();
  try {
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`[EMAIL] Sent to ${to}: ${subject}`);
  } catch (err) {
    // ล็อก error แต่ไม่ throw — ไม่ให้ email failure พัง API response
    console.error(`[EMAIL] Failed to send to ${to}:`, err);
  }
}

// ─────────────────────────────────────────────
// Email template base
// ─────────────────────────────────────────────

function baseTemplate(title: string, body: string): string {
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

function btn(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#1d4ed8;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;font-size:14px;">${label}</a>`;
}

function infoRow(label: string, value: string): string {
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
}): Promise<void> {
  const { to, customerName, action } = params;

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
        ขออภัย คำขอสมัครสมาชิกของคุณไม่ได้รับการอนุมัติในครั้งนี้
        หากมีข้อสงสัยกรุณาติดต่อเจ้าหน้าที่
      </p>
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
