"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, CreditCard, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Receipt = {
  id: string;
  jobId: string;
  totalAmount: string | number;
  status: "UNPAID" | "PAID" | "CANCELLED";
  createdAt: string;
  employee?: { employeeName: string };
  payments: Array<{
    id: string;
    amount: string | number;
    paymentMethod: string;
    paymentDate: string;
    slipUrl?: string | null;
  }>;
  job: {
    id: string;
    jobType: string;
    jobAddress: string;
    customer: {
      customerName: string;
      customerPhone: string;
      customerEmail?: string | null;
    };
    quotation?: { totalAmount: string | number } | null;
  };
};

const JOB_TYPE_LABEL: Record<string, string> = {
  INSTALLATION: "ติดตั้งลิฟต์",
  REPAIR: "ซ่อมรายครั้ง",
  SERVICE: "บำรุงรักษา",
};

const STATUS_INFO: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "default" }> = {
  UNPAID: { label: "รอชำระเงิน", variant: "warning" },
  PAID: { label: "ชำระเงินแล้ว", variant: "success" },
  CANCELLED: { label: "ยกเลิก", variant: "destructive" },
};

export default function AccountantInvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/invoices/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setReceipt(d.data);
        else setError(d.message ?? "ไม่พบข้อมูลใบแจ้งหนี้");
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการโหลดข้อมูลใบแจ้งหนี้"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-20 text-center">
        <p className="text-muted-foreground">{error ?? "ไม่พบข้อมูลใบแจ้งหนี้"}</p>
        <Link href="/accountant/invoices">
          <Button variant="outline">กลับไปหน้ารายการ</Button>
        </Link>
      </div>
    );
  }

  const statusInfo = STATUS_INFO[receipt.status] ?? STATUS_INFO.UNPAID;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/accountant/invoices" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          กลับไปหน้ารายการใบแจ้งหนี้
        </Link>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-2">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">ใบแจ้งหนี้ #{receipt.id.slice(0, 8)}</CardTitle>
                <CardDescription>
                  วันที่ออก: {new Date(receipt.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
                </CardDescription>
              </div>
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">ลูกค้า</p>
              <p className="mt-1 font-semibold">{receipt.job.customer.customerName}</p>
              <p className="text-sm text-muted-foreground">{receipt.job.customer.customerPhone}</p>
              {receipt.job.customer.customerEmail && <p className="text-sm text-muted-foreground">{receipt.job.customer.customerEmail}</p>}
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">งาน</p>
              <p className="mt-1 font-semibold">{JOB_TYPE_LABEL[receipt.job.jobType] ?? receipt.job.jobType}</p>
              <p className="text-sm text-muted-foreground">{receipt.job.jobAddress}</p>
            </div>
          </div>

          <div className="rounded-lg border p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">ยอดรวม</span>
              <span className="text-2xl font-bold text-primary">
                {Number(receipt.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
              </span>
            </div>
            <div className="mt-3 text-sm text-muted-foreground">
              ผู้ออกใบ: {receipt.employee?.employeeName ?? "ฝ่ายบัญชี"}
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <CreditCard className="h-5 w-5" />
              ประวัติการชำระเงิน
            </h3>
            {receipt.payments.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                ยังไม่มีประวัติการชำระเงิน
              </div>
            ) : (
              <div className="space-y-3">
                {receipt.payments.map((payment) => (
                  <div key={payment.id} className="rounded-md border p-3 text-sm">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{payment.paymentMethod}</p>
                        <p className="text-muted-foreground">{new Date(payment.paymentDate).toLocaleString("th-TH")}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{Number(payment.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท</p>
                        {payment.slipUrl && (
                          <a href={payment.slipUrl} target="_blank" rel="noreferrer" className="text-primary underline text-xs">
                            ดูสลิป
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {receipt.status === "PAID" && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="h-4 w-4" />
              ชำระเงินเรียบร้อยแล้ว
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
