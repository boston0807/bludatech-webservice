"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CreditCard, FileText, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Receipt = {
  id: string;
  jobId: string;
  totalAmount: string | number;
  status: "UNPAID" | "PAID" | "CANCELLED";
  createdAt: string;
  job: {
    jobType: string;
    jobAddress: string;
  };
  payments: Array<{
    id: string;
    amount: string | number;
  }>;
};

const JOB_TYPE_LABEL: Record<string, string> = {
  INSTALLATION: "ติดตั้งลิฟต์",
  REPAIR: "ซ่อมรายครั้ง",
  SERVICE: "บำรุงรักษา",
};

const STATUS_LABEL: Record<string, { text: string; variant: "default" | "success" | "warning" | "destructive" }> = {
  UNPAID: { text: "รอชำระเงิน", variant: "warning" },
  PAID: { text: "ชำระเงินแล้ว", variant: "success" },
  CANCELLED: { text: "ยกเลิก", variant: "destructive" },
};

export default function CustomerInvoicesPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setReceipts(d.data ?? []);
        } else {
          setError(d.message ?? "โหลดใบแจ้งหนี้ไม่สำเร็จ");
        }
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ใบแจ้งหนี้ของฉัน</h1>
        <p className="text-muted-foreground">ติดตามและชำระเงินค่าบริการสำหรับงานลิฟต์ทั้งหมด</p>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : receipts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            ยังไม่มีใบแจ้งหนี้สำหรับงานของคุณในขณะนี้
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {receipts.map((receipt) => {
            const statusInfo = STATUS_LABEL[receipt.status] ?? STATUS_LABEL.UNPAID;

            return (
              <Card key={receipt.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-full bg-primary/10 p-2">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">ใบแจ้งหนี้ #{receipt.id.slice(0, 8)}</CardTitle>
                        <CardDescription>
                          {JOB_TYPE_LABEL[receipt.job?.jobType ?? "SERVICE"] ?? "บริการลิฟต์"} • {receipt.job?.jobAddress ?? "-"}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                    <span>วันที่ออกใบ: {new Date(receipt.createdAt).toLocaleDateString("th-TH")}</span>
                    <span className="text-base font-semibold text-foreground">
                      ยอดรวม: {Number(receipt.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Link href={`/jobs/${receipt.jobId}/invoice`}>
                      <Button size="sm" className="gap-2">
                        <CreditCard className="h-4 w-4" />
                        {receipt.status === "PAID" ? "ดูรายละเอียด" : "ดู/ชำระเงิน"}
                      </Button>
                    </Link>
                    <Link href={`/jobs/${receipt.jobId}`}>
                      <Button size="sm" variant="outline" className="gap-2">
                        ไปที่ใบงาน
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
