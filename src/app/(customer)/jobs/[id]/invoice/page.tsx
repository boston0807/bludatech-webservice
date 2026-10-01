// src/app/(customer)/jobs/[id]/invoice/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, ChevronLeft, FileText, CheckCircle2, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Payment = {
  id: string;
  paymentDate: string;
  amount: string;
  paymentMethod: string;
  verified: boolean;
};

type Receipt = {
  id: string;
  jobId: string;
  totalAmount: string;
  status: "UNPAID" | "PAID" | "CANCELLED";
  createdAt: string;
  employee?: { employeeName?: string };
  payments: Payment[];
  job?: {
    jobType?: string;
    jobAddress?: string;
    customer?: { customerName?: string; customerPhone?: string; customerAddress?: string };
    quotation?: { totalAmount?: string };
  };
};

const JOB_TYPE_LABEL: Record<string, string> = {
  INSTALLATION: "ติดตั้งลิฟต์",
  REPAIR: "ซ่อมรายครั้ง",
  SERVICE: "บำรุงรักษา",
};

export default function CustomerInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = use(params);
  const router = useRouter();

  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Payment form states
  const [paymentMethod, setPaymentMethod] = useState<"TRANSFER" | "CASH" | "CREDIT_CARD">("TRANSFER");
  const [slipUrl, setSlipUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchReceipt = () => {
    setLoading(true);
    fetch(`/api/jobs/${jobId}/invoice`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setReceipt(d.data);
        else setError(d.message ?? "ไม่พบใบแจ้งหนี้");
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการโหลดใบแจ้งหนี้"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReceipt();
  }, [jobId]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receipt) return;

    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/invoices/${receipt.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(receipt.totalAmount),
          paymentMethod,
          slipUrl: slipUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message ?? "ชำระเงินไม่สำเร็จ");
        return;
      }
      setSuccessMsg("ชำระเงินสำเร็จเรียบร้อย");
      fetchReceipt();
    } catch {
      setErrorMsg("เกิดข้อผิดพลาดในการชำระเงิน");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-xl mx-auto py-20 text-center space-y-4">
        <p className="text-muted-foreground">{error ?? "ไม่พบใบแจ้งหนี้สำหรับใบงานนี้ (อาจยังไม่ได้ออกใบแจ้งหนี้จากฝ่ายบัญชี)"}</p>
        <Link href={`/jobs/${jobId}`}>
          <Button variant="outline">กลับไปหน้าใบงาน</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <Link href={`/jobs/${jobId}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3">
          <ChevronLeft className="h-4 w-4" />
          กลับไปหน้าใบงาน
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">ใบแจ้งหนี้ / ใบเสร็จรับเงิน</h1>
        <p className="text-muted-foreground text-sm">รายละเอียดการชำระเงินค่าบริการลิฟต์</p>
      </div>

      {successMsg && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
          {errorMsg}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">ใบแจ้งหนี้ #{receipt.id.slice(0, 8)}</CardTitle>
            </div>
            <Badge variant={receipt.status === "PAID" ? "success" : "warning"}>
              {receipt.status === "PAID" ? "ชำระเงินแล้ว" : "รอชำระเงิน"}
            </Badge>
          </div>
          <CardDescription>
            วันที่ออก: {new Date(receipt.createdAt).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
            <p className="font-medium">สถานที่บริการ: {receipt.job?.jobAddress ?? "-"}</p>
            <p className="text-muted-foreground">ประเภทงาน: {JOB_TYPE_LABEL[receipt.job?.jobType ?? "SERVICE"] ?? receipt.job?.jobType ?? "บริการ"}</p>
            <p className="text-muted-foreground">ผู้ออกเอกสาร: {receipt.employee?.employeeName ?? "ฝ่ายบัญชี"}</p>
          </div>

          <div className="flex justify-between items-center py-2 border-t">
            <span className="text-muted-foreground">ยอดชำระทั้งสิ้น</span>
            <span className="text-2xl font-bold text-primary">
              {parseFloat(receipt.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
            </span>
          </div>

          {receipt.status === "PAID" && (
            <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm text-green-800 space-y-1">
              <p className="font-semibold flex items-center gap-1">
                <CheckCircle2 className="h-4 w-4 text-green-600" /> ชำระเงินเรียบร้อยแล้ว
              </p>
              {receipt.payments.map((p) => (
                <p key={p.id} className="text-xs">
                  ชำระเมื่อ: {new Date(p.paymentDate).toLocaleString("th-TH")} | วิธี: {p.paymentMethod} | จำนวน: {parseFloat(p.amount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {receipt.status === "UNPAID" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4" /> ชำระเงิน
            </CardTitle>
            <CardDescription>เลือกช่องทางการชำระเงินและแนบหลักฐาน (ถ้ามี)</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethod">วิธีชำระเงิน</Label>
                <select
                  id="paymentMethod"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="TRANSFER">โอนเงินผ่านธนาคาร</option>
                  <option value="CASH">เงินสด</option>
                  <option value="CREDIT_CARD">บัตรเครดิต</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="slipUrl">ลิงก์หลักฐานการโอนเงิน (Slip URL / หมายเหตุ)</Label>
                <Input
                  id="slipUrl"
                  placeholder="เช่น https://example.com/slip.jpg หรือ โอนผ่าน SCB 12:34 น."
                  value={slipUrl}
                  onChange={(e) => setSlipUrl(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={submitting} className="w-full">
                {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                ยืนยันการชำระเงิน {parseFloat(receipt.totalAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
