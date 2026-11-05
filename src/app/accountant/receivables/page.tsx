// src/app/accountant/receivables/page.tsx
// ลูกหนี้ค้างชำระ (Aging) — ใบแจ้งหนี้ที่ส่งให้ลูกค้าแล้วแต่ยังไม่ชำระ แบ่งตามจำนวนวันที่ค้าง
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Download, Loader2, Phone, Printer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JOB_TYPE_LABEL, baht, thDate } from "@/lib/labels";
import { daysUntil } from "@/lib/dates";
import { downloadCsv, csvDate } from "@/lib/csv";

type ReceiptItem = {
  id: string;
  jobId: string;
  totalAmount: string | number;
  status: string;
  createdAt: string;
  job: {
    jobType: string;
    jobAddress: string;
    customer: { customerName: string; customerPhone: string; customerEmail?: string | null };
  };
  payments: { amount: string | number }[];
};

const BUCKETS = [
  { key: "0-30", label: "0–30 วัน", min: 0, max: 30, tone: "border-green-300", badge: "secondary" as const },
  { key: "31-60", label: "31–60 วัน", min: 31, max: 60, tone: "border-amber-400", badge: "warning" as const },
  { key: "60+", label: "มากกว่า 60 วัน", min: 61, max: Infinity, tone: "border-destructive", badge: "destructive" as const },
];

function bucketOf(days: number) {
  return BUCKETS.find((b) => days >= b.min && days <= b.max) ?? BUCKETS[0];
}

export default function ReceivablesPage() {
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<string>("");

  useEffect(() => {
    fetch("/api/invoices?status=UNPAID")
      .then((r) => r.json())
      .then((d) => (d.success ? setReceipts(d.data) : setError(d.message ?? "โหลดข้อมูลไม่สำเร็จ")))
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  const rows = useMemo(() => {
    const now = new Date();
    return receipts
      .map((r) => {
        const paid = r.payments.reduce((s, p) => s + Number(p.amount), 0);
        const outstanding = Math.max(0, Number(r.totalAmount) - paid);
        const days = Math.max(0, -daysUntil(new Date(r.createdAt), now));
        return { ...r, paid, outstanding, days, bucket: bucketOf(days) };
      })
      .filter((r) => r.outstanding > 0)
      .sort((a, b) => b.days - a.days);
  }, [receipts]);

  const summary = BUCKETS.map((b) => {
    const list = rows.filter((r) => r.bucket.key === b.key);
    return { ...b, count: list.length, amount: list.reduce((s, r) => s + r.outstanding, 0) };
  });
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0);
  const visible = bucket ? rows.filter((r) => r.bucket.key === bucket) : rows;

  const exportCsv = () =>
    downloadCsv(
      `receivables-${csvDate(new Date())}`,
      ["เลขที่ใบแจ้งหนี้", "เลขที่ใบงาน", "ลูกค้า", "เบอร์โทร", "อีเมล", "ประเภทงาน", "วันที่ออก", "ค้าง (วัน)", "ช่วงอายุหนี้", "ยอดใบแจ้งหนี้", "ชำระแล้ว", "คงค้าง"],
      visible.map((r) => [
        r.id,
        r.jobId,
        r.job.customer.customerName,
        r.job.customer.customerPhone,
        r.job.customer.customerEmail ?? "",
        JOB_TYPE_LABEL[r.job.jobType] ?? r.job.jobType,
        csvDate(r.createdAt),
        r.days,
        r.bucket.label,
        Number(r.totalAmount).toFixed(2),
        r.paid.toFixed(2),
        r.outstanding.toFixed(2),
      ])
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ลูกหนี้ค้างชำระ</h1>
          <p className="text-muted-foreground">
            ใบแจ้งหนี้ที่ส่งลูกค้าแล้วแต่ยังไม่ชำระ นับวันค้างจากวันที่ออกใบแจ้งหนี้ · คงค้างรวม {baht(totalOutstanding)}
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={visible.length === 0}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> พิมพ์
          </Button>
        </div>
      </div>

      {error && <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{error}</div>}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {summary.map((b) => (
              <button
                key={b.key}
                type="button"
                onClick={() => setBucket((cur) => (cur === b.key ? "" : b.key))}
                className="text-left"
                aria-pressed={bucket === b.key}
              >
                <Card className={`border-l-4 ${b.tone} ${bucket === b.key ? "ring-2 ring-primary" : ""} hover:shadow-md transition-shadow`}>
                  <CardContent className="pt-5">
                    <p className="text-sm text-muted-foreground">ค้าง {b.label}</p>
                    <p className="text-xl font-bold">{baht(b.amount)}</p>
                    <p className="text-xs text-muted-foreground">{b.count} ใบแจ้งหนี้</p>
                  </CardContent>
                </Card>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                รายการค้างชำระ {bucket && `(${summary.find((b) => b.key === bucket)?.label})`}
              </CardTitle>
              <CardDescription>เรียงจากค้างนานที่สุด · กดการ์ดด้านบนเพื่อกรองตามช่วงอายุหนี้</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {visible.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">ไม่มีใบแจ้งหนี้ค้างชำระ</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground border-b">
                      <th className="py-2 pr-3 font-medium">ลูกค้า</th>
                      <th className="py-2 pr-3 font-medium">งาน</th>
                      <th className="py-2 pr-3 font-medium">วันที่ออก</th>
                      <th className="py-2 pr-3 font-medium text-right">ค้าง</th>
                      <th className="py-2 pr-3 font-medium text-right">คงค้าง</th>
                      <th className="py-2 font-medium print:hidden"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => (
                      <tr key={r.id} className="border-b last:border-0">
                        <td className="py-2 pr-3">
                          <p className="font-medium">{r.job.customer.customerName}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Phone className="h-3 w-3" /> {r.job.customer.customerPhone}
                          </p>
                        </td>
                        <td className="py-2 pr-3">
                          <p>{JOB_TYPE_LABEL[r.job.jobType] ?? r.job.jobType}</p>
                          <p className="text-xs text-muted-foreground max-w-[220px] truncate">{r.job.jobAddress}</p>
                        </td>
                        <td className="py-2 pr-3">{thDate(r.createdAt)}</td>
                        <td className="py-2 pr-3 text-right">
                          <Badge variant={r.bucket.badge}>{r.days} วัน</Badge>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums font-semibold">{baht(r.outstanding)}</td>
                        <td className="py-2 text-right print:hidden">
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/accountant/invoices/${r.id}`}>ดู</Link>
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
