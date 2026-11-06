// src/components/documents/printable-document.tsx
// เอกสารสำหรับพิมพ์ / บันทึกเป็น PDF (ใบเสนอราคา, ใบแจ้งหนี้, ใบเสร็จรับเงิน)
// แสดงเฉพาะตอนพิมพ์ (hidden print:block) — หน้าเว็บปกติซ่อนส่วนอื่นด้วย print:hidden
"use client";

import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { JOB_TYPE_LABEL, thDate } from "@/lib/labels";

export type DocKind = "QUOTATION" | "INVOICE" | "RECEIPT";

const TITLE: Record<DocKind, { th: string; en: string }> = {
  QUOTATION: { th: "ใบเสนอราคา", en: "QUOTATION" },
  INVOICE: { th: "ใบแจ้งหนี้", en: "INVOICE" },
  RECEIPT: { th: "ใบเสร็จรับเงิน", en: "RECEIPT" },
};

const PAYMENT_METHOD_TH: Record<string, string> = {
  TRANSFER: "โอนเงินผ่านธนาคาร",
  CASH: "เงินสด",
  CREDIT_CARD: "บัตรเครดิต",
};

export type PrintableDocumentProps = {
  kind: DocKind;
  docNo: string;
  issuedAt: string | Date;
  jobId: string;
  jobType: string;
  jobAddress: string;
  customer: {
    customerName: string;
    customerAddress?: string | null;
    customerPhone?: string | null;
    customerEmail?: string | null;
    taxId?: string | null;
  };
  expenses: { expenseName: string; quantity: number; price: string | number }[];
  jobWage: string | number;
  totalAmount: string | number;
  payments?: { paymentDate: string; amount: string | number; paymentMethod: string }[];
  issuedBy?: string | null;
  note?: string | null;
};

const fmt = (n: number) => n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PrintButton({ label = "พิมพ์ / บันทึก PDF" }: { label?: string }) {
  return (
    <Button type="button" variant="outline" size="sm" className="print:hidden" onClick={() => window.print()}>
      <Printer className="h-4 w-4" /> {label}
    </Button>
  );
}

export function PrintableDocument(props: PrintableDocumentProps) {
  const { kind, docNo, issuedAt, jobId, jobType, jobAddress, customer, expenses, payments, issuedBy, note } = props;
  const title = TITLE[kind];
  const lines = expenses.map((e) => ({ ...e, amount: Number(e.price) * e.quantity }));
  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const wage = Number(props.jobWage) || 0;
  const total = Number(props.totalAmount) || 0;
  // ยอดในเอกสารอ้างอิง totalAmount เสมอ — ถ้ารายการ + ค่าแรงไม่ตรง (ข้อมูลเก่า) แสดงส่วนต่างเป็นรายการปรับยอด
  const adjust = Math.round((total - subtotal - wage) * 100) / 100;
  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);

  const cellL = "border border-gray-400 px-2 py-1 text-left";
  const cellR = "border border-gray-400 px-2 py-1 text-right tabular-nums";

  return (
    <div className="hidden print:block text-[12px] leading-relaxed text-black">
      <div className="flex items-start justify-between border-b-2 border-black pb-3">
        <div>
          <p className="text-lg font-bold">Bludatech Service</p>
          <p>บริการติดตั้ง ซ่อม และบำรุงรักษาลิฟต์โดยสาร</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold">{title.th}</p>
          <p className="tracking-widest">{title.en}</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-6">
        <div>
          <p className="font-semibold">ลูกค้า</p>
          <p>{customer.customerName}</p>
          {customer.customerAddress && <p>{customer.customerAddress}</p>}
          {customer.customerPhone && <p>โทร {customer.customerPhone}</p>}
          {customer.customerEmail && <p>{customer.customerEmail}</p>}
          {customer.taxId && <p>เลขประจำตัวผู้เสียภาษี {customer.taxId}</p>}
        </div>
        <table className="self-start">
          <tbody>
            <tr><td className="pr-3 text-gray-600">เลขที่</td><td className="font-mono">{docNo}</td></tr>
            <tr><td className="pr-3 text-gray-600">วันที่</td><td>{thDate(issuedAt)}</td></tr>
            <tr><td className="pr-3 text-gray-600">อ้างอิงใบงาน</td><td className="font-mono">{jobId}</td></tr>
            <tr><td className="pr-3 text-gray-600">ประเภทงาน</td><td>{JOB_TYPE_LABEL[jobType] ?? jobType}</td></tr>
            <tr><td className="pr-3 text-gray-600 align-top">สถานที่</td><td>{jobAddress}</td></tr>
          </tbody>
        </table>
      </div>

      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="bg-gray-100">
            <th className={cellL} style={{ width: 40 }}>#</th>
            <th className={cellL}>รายการ</th>
            <th className={cellR} style={{ width: 70 }}>จำนวน</th>
            <th className={cellR} style={{ width: 110 }}>ราคา/หน่วย</th>
            <th className={cellR} style={{ width: 120 }}>จำนวนเงิน</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td className={cellL}>{i + 1}</td>
              <td className={cellL}>{l.expenseName}</td>
              <td className={cellR}>{l.quantity}</td>
              <td className={cellR}>{fmt(Number(l.price))}</td>
              <td className={cellR}>{fmt(l.amount)}</td>
            </tr>
          ))}
          {wage > 0 && (
            <tr>
              <td className={cellL}>{lines.length + 1}</td>
              <td className={cellL}>ค่าแรง / ค่าบริการ</td>
              <td className={cellR}>1</td>
              <td className={cellR}>{fmt(wage)}</td>
              <td className={cellR}>{fmt(wage)}</td>
            </tr>
          )}
          {adjust !== 0 && (
            <tr>
              <td className={cellL}></td>
              <td className={cellL}>ปรับยอดตามใบเสนอราคาที่อนุมัติ</td>
              <td className={cellR}></td>
              <td className={cellR}></td>
              <td className={cellR}>{fmt(adjust)}</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td className={cellR} colSpan={4}>ยอดรวมทั้งสิ้น (บาท)</td>
            <td className={cellR}>{fmt(total)}</td>
          </tr>
          {kind !== "QUOTATION" && payments && payments.length > 0 && (
            <>
              <tr>
                <td className={cellR} colSpan={4}>ชำระแล้ว</td>
                <td className={cellR}>{fmt(paid)}</td>
              </tr>
              <tr className="font-bold">
                <td className={cellR} colSpan={4}>คงค้าง</td>
                <td className={cellR}>{fmt(Math.max(0, total - paid))}</td>
              </tr>
            </>
          )}
        </tfoot>
      </table>

      {kind === "RECEIPT" && payments && payments.length > 0 && (
        <div className="mt-3">
          <p className="font-semibold">รายละเอียดการรับชำระ</p>
          {payments.map((p, i) => (
            <p key={i}>
              {thDate(p.paymentDate)} · {PAYMENT_METHOD_TH[p.paymentMethod] ?? p.paymentMethod} · {fmt(Number(p.amount))} บาท
            </p>
          ))}
        </div>
      )}

      {kind === "QUOTATION" && (
        <p className="mt-3 text-gray-700">ใบเสนอราคานี้อ้างอิงจากผลการสำรวจหน้างาน ราคาอาจเปลี่ยนแปลงหากขอบเขตงานเปลี่ยน</p>
      )}
      {kind === "INVOICE" && <p className="mt-3 text-gray-700">กรุณาชำระเงินผ่านระบบ หรือติดต่อฝ่ายบัญชี</p>}
      {note && <p className="mt-2 text-gray-700">หมายเหตุ: {note}</p>}

      <div className="mt-16 grid grid-cols-2 gap-16 text-center">
        <div>
          <div className="border-t border-black pt-1">{kind === "QUOTATION" ? "ผู้อนุมัติ (ลูกค้า)" : "ผู้รับเอกสาร (ลูกค้า)"}</div>
        </div>
        <div>
          <div className="border-t border-black pt-1">
            {kind === "RECEIPT" ? "ผู้รับเงิน" : "ผู้ออกเอกสาร"}
            {issuedBy ? ` — ${issuedBy}` : ""}
          </div>
        </div>
      </div>
      <p className="mt-6 text-center text-[10px] text-gray-500">พิมพ์จากระบบเมื่อ {thDate(new Date())}</p>
    </div>
  );
}
