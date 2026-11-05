// src/lib/notifications.ts
// การแจ้งเตือนในระบบ (กระดิ่งบน top-nav) — เก็บ 1 แถวต่อผู้รับ 1 คน
// เรียกหลัง transaction ของงานหลัก commit แล้ว และไม่ throw (แจ้งเตือนพังต้องไม่ทำให้งานหลักพัง)
// แต่ต้อง await เสมอ: บน Cloudflare Workers promise ที่ไม่ได้รอจะถูกตัดทิ้งเมื่อส่ง response แล้ว

import type { EmployeeRole, Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { baht } from "@/lib/labels";

type Db = PrismaClient | Prisma.TransactionClient;

export type Recipient =
  | { customerId: string }
  | { employeeIds: string[] }
  | { roles: EmployeeRole[] };

export type NotificationInput = {
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
};

async function resolveRecipients(db: Db, recipients: Recipient[]) {
  const customerIds = new Set<string>();
  const employeeIds = new Set<string>();
  const roles = new Set<EmployeeRole>();

  for (const r of recipients) {
    if ("customerId" in r) customerIds.add(r.customerId);
    else if ("employeeIds" in r) r.employeeIds.forEach((id) => employeeIds.add(id));
    else r.roles.forEach((role) => roles.add(role));
  }
  if (roles.size > 0) {
    const staff = await db.employee.findMany({ where: { role: { in: [...roles] } }, select: { id: true } });
    staff.forEach((e) => employeeIds.add(e.id));
  }
  return { customerIds: [...customerIds], employeeIds: [...employeeIds] };
}

export async function notify(
  recipients: Recipient | Recipient[],
  n: NotificationInput,
  opts: { excludeEmployeeId?: string; db?: Db } = {}
): Promise<void> {
  const db = opts.db ?? prisma;
  try {
    const { customerIds, employeeIds } = await resolveRecipients(db, Array.isArray(recipients) ? recipients : [recipients]);
    const base = { type: n.type, title: n.title, body: n.body ?? null, link: n.link ?? null };
    const rows = [
      ...customerIds.map((customerId) => ({ ...base, customerId })),
      // ไม่แจ้งเตือนคนที่เป็นผู้ทำรายการเอง
      ...employeeIds.filter((id) => id !== opts.excludeEmployeeId).map((employeeId) => ({ ...base, employeeId })),
    ];
    if (rows.length > 0) await db.notification.createMany({ data: rows });
  } catch (error) {
    console.error("[NOTIFY_ERROR]", n.type, error);
  }
}

// ─────────────────────────────────────────────
// เหตุการณ์ในกระบวนการงาน — รวมข้อความไว้ที่เดียว (คู่กับ src/lib/email.ts)
// ─────────────────────────────────────────────

const short = (id: string) => `#${id.slice(-8)}`;

export const Notify = {
  // ลูกค้าสมัครสมาชิก / ส่งข้อมูลใหม่ → ธุรการตรวจสอบ
  customerRegistered: (p: { customerName: string; resubmitted?: boolean }) =>
    notify({ roles: ["ADMIN"] }, {
      type: "CUSTOMER_PENDING",
      title: p.resubmitted ? "ลูกค้าแก้ไขข้อมูลสมัครสมาชิกแล้ว" : "มีลูกค้าสมัครสมาชิกใหม่",
      body: `${p.customerName} รอการอนุมัติบัญชี`,
      link: "/admin/customers/pending",
    }),

  // ลูกค้าเปิดใบงานใหม่ → ช่างไปสำรวจ
  jobCreated: (p: { jobId: string; jobTypeLabel: string; customerName: string; jobAddress: string }) =>
    notify({ roles: ["HEAD_TECHNICIAN", "TECHNICIAN"] }, {
      type: "JOB_CREATED",
      title: `ใบงานใหม่รอสำรวจ: ${p.jobTypeLabel}`,
      body: `${p.customerName} — ${p.jobAddress}`,
      link: "/technician/jobs",
    }),

  // ช่างสำรวจเสร็จ → บัญชีออกใบเสนอราคา
  surveyDone: (p: { jobId: string; customerName: string; byEmployeeId: string }) =>
    notify({ roles: ["ACCOUNTANT"] }, {
      type: "SURVEY_DONE",
      title: "ผลสำรวจพร้อมแล้ว รอออกใบเสนอราคา",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}`,
      link: `/accountant/quotations/${p.jobId}`,
    }, { excludeEmployeeId: p.byEmployeeId }),

  quotationCreated: (p: { jobId: string; customerId: string; totalAmount: number | string }) =>
    notify({ customerId: p.customerId }, {
      type: "QUOTATION_CREATED",
      title: "ใบเสนอราคาพร้อมให้พิจารณา",
      body: `ใบงาน ${short(p.jobId)} ยอดรวม ${baht(p.totalAmount)}`,
      link: `/jobs/${p.jobId}`,
    }),

  quotationApproved: (p: { jobId: string; customerName: string }) =>
    notify({ roles: ["HEAD_TECHNICIAN"] }, {
      type: "QUOTATION_APPROVED",
      title: "ลูกค้าอนุมัติใบเสนอราคา รอจัดทำแผนงาน",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}`,
      link: "/technician/workplans",
    }),

  quotationRejected: (p: { jobId: string; customerName: string; note: string | null }) =>
    notify({ roles: ["ACCOUNTANT", "HEAD_TECHNICIAN"] }, {
      type: "QUOTATION_REJECTED",
      title: "ลูกค้าขอแก้ไขใบเสนอราคา",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}${p.note ? `: ${p.note}` : ""}`,
      link: `/accountant/quotations/${p.jobId}`,
    }),

  jobCancelled: (p: { jobId: string; customerName: string }) =>
    notify({ roles: ["ACCOUNTANT", "ADMIN"] }, {
      type: "JOB_CANCELLED",
      title: "ลูกค้ายกเลิกใบงาน",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}`,
      link: null,
    }),

  workPlanCreated: (p: { jobId: string; customerId: string }) =>
    notify({ customerId: p.customerId }, {
      type: "WORKPLAN_CREATED",
      title: "แผนงานพร้อมให้อนุมัติ",
      body: `ใบงาน ${short(p.jobId)} — กรุณาตรวจสอบกำหนดการเข้าดำเนินงาน`,
      link: `/jobs/${p.jobId}`,
    }),

  workPlanApproved: (p: { jobId: string; technicianIds: string[]; customerName: string }) =>
    notify([{ employeeIds: p.technicianIds }, { roles: ["HEAD_TECHNICIAN"] }], {
      type: "WORKPLAN_APPROVED",
      title: "ลูกค้าอนุมัติแผนงานแล้ว พร้อมเริ่มงาน",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}`,
      link: "/technician/workplans",
    }),

  workPlanRejected: (p: { jobId: string; customerName: string; note: string }) =>
    notify({ roles: ["HEAD_TECHNICIAN"] }, {
      type: "WORKPLAN_REJECTED",
      title: "ลูกค้าขอให้ปรับแผนงาน",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}: ${p.note}`,
      link: "/technician/workplans",
    }),

  waitingAcceptance: (p: { jobId: string; customerId: string }) =>
    notify({ customerId: p.customerId }, {
      type: "WAITING_ACCEPTANCE",
      title: "งานเสร็จแล้ว กรุณาตรวจรับงาน",
      body: `ใบงาน ${short(p.jobId)} ผ่านการทดสอบความปลอดภัยแล้ว`,
      link: `/jobs/${p.jobId}`,
    }),

  workRejected: (p: { jobId: string; technicianIds: string[]; customerName: string; note: string }) =>
    notify([{ employeeIds: p.technicianIds }, { roles: ["HEAD_TECHNICIAN"] }], {
      type: "WORK_REJECTED",
      title: "ลูกค้าตรวจรับงานไม่ผ่าน ต้องแก้ไข",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}: ${p.note}`,
      link: "/technician/workplans",
    }),

  workAccepted: (p: { jobId: string; customerName: string; hasDraftInvoice: boolean }) =>
    notify(p.hasDraftInvoice ? { roles: ["ACCOUNTANT"] } : { roles: ["ADMIN"] }, {
      type: "WORK_ACCEPTED",
      title: p.hasDraftInvoice ? "ลูกค้าตรวจรับงานแล้ว ใบแจ้งหนี้ร่างรอตรวจสอบ" : "ลูกค้าตรวจรับงานแล้ว (ไม่มียอดเรียกเก็บ) รอบันทึกประวัติ",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName}`,
      link: p.hasDraftInvoice ? "/accountant/invoices" : "/admin/service-history",
    }),

  invoiceIssued: (p: { jobId: string; customerId: string; totalAmount: number | string }) =>
    notify({ customerId: p.customerId }, {
      type: "INVOICE_ISSUED",
      title: "ใบแจ้งหนี้พร้อมชำระ",
      body: `ใบงาน ${short(p.jobId)} ยอดชำระ ${baht(p.totalAmount)}`,
      link: `/jobs/${p.jobId}/invoice`,
    }),

  paymentReceived: (p: { jobId: string; receiptId: string; customerName: string; amount: number | string; hasSlip: boolean }) =>
    notify({ roles: ["ACCOUNTANT", "ADMIN"] }, {
      type: "PAYMENT_RECEIVED",
      title: p.hasSlip ? "ลูกค้าชำระเงินพร้อมแนบสลิป" : "ลูกค้าชำระเงินแล้ว",
      body: `ใบงาน ${short(p.jobId)} — ${p.customerName} ${baht(p.amount)} · รอธุรการบันทึกประวัติ`,
      link: `/accountant/invoices/${p.receiptId}`,
    }),

  serviceRoundCreated: (p: {
    jobId: string;
    customerId: string;
    customerName: string;
    roundNumber: number;
    dueDateLabel: string;
    automatic: boolean;
  }) =>
    Promise.all([
      notify({ roles: ["ADMIN"] }, {
        type: "SERVICE_ROUND_CREATED",
        title: `${p.automatic ? "ระบบสร้าง" : "สร้าง"}ใบงานรอบบำรุงครั้งที่ ${p.roundNumber} แล้ว`,
        body: `${p.customerName} — กำหนด ${p.dueDateLabel}`,
        link: "/admin/service-rounds",
      }),
      notify({ roles: ["HEAD_TECHNICIAN", "TECHNICIAN"] }, {
        type: "SERVICE_ROUND_CREATED",
        title: `ใบงานรอบบำรุงครั้งที่ ${p.roundNumber} รอเข้าบำรุง`,
        body: `${p.customerName} — กำหนด ${p.dueDateLabel}`,
        link: "/technician/jobs",
      }),
      notify({ customerId: p.customerId }, {
        type: "SERVICE_ROUND_CREATED",
        title: `นัดบำรุงรักษาลิฟต์ครั้งที่ ${p.roundNumber}`,
        body: `กำหนด ${p.dueDateLabel}`,
        link: `/jobs/${p.jobId}`,
      }),
    ]).then(() => undefined),
};
