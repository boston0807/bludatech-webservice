// src/app/accountant/invoices/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Receipt, FileText, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";

type Job = {
  id: string;
  jobType: string;
  jobAddress: string;
  status: string;
  customer?: { customerName: string; customerPhone: string };
  quotation?: { totalAmount: number };
  receipt?: { id: string; status: string; totalAmount: number };
};

type ReceiptItem = {
  id: string;
  jobId: string;
  totalAmount: number;
  status: string;
  createdAt: string;
  job: {
    jobType: string;
    jobAddress: string;
    customer: { customerName: string; customerPhone: string; customerEmail?: string };
  };
  payments: { id: string; paymentMethod: string; amount: number; paymentDate: string; slipUrl?: string }[];
};

export default function AccountantInvoicesPage() {
  const [acceptedJobs, setAcceptedJobs] = useState<Job[]>([]);
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/jobs").then((r) => r.json()),
      fetch("/api/invoices").then((r) => r.json()),
    ])
      .then(([jobsRes, invoicesRes]) => {
        if (jobsRes.success) {
          // Jobs that are ACCEPTED or PAID/COMPLETED
          const filtered = jobsRes.data.filter((j: Job) =>
            ["ACCEPTED", "PAID", "COMPLETED"].includes(j.status)
          );
          setAcceptedJobs(filtered);
        }
        if (invoicesRes.success) {
          setReceipts(invoicesRes.data);
        }
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการโหลดข้อมูล"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleIssueInvoice = async (jobId: string) => {
    setActionLoading(jobId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/invoice`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("ออกใบแจ้งหนี้สำเร็จ");
        loadData();
      } else {
        setError(data.message || "ออกใบแจ้งหนี้ไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการออกใบแจ้งหนี้");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ออกใบแจ้งหนี้และชำระเงิน (UC15, UC16)</h1>
        <p className="text-muted-foreground">ออกใบแจ้งหนี้สำหรับงานที่ตรวจรับแล้ว และตรวจสอบการชำระเงินของลูกค้า</p>
      </div>

      {error && <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{error}</div>}
      {successMsg && <div className="p-4 bg-green-50 text-green-700 text-sm rounded-md border border-green-200">{successMsg}</div>}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-8">
          {/* Section 1: Jobs waiting for Invoice (ACCEPTED status without receipt) */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              ใบงานที่พร้อมออกใบแจ้งหนี้ (สถานะ ACCEPTED)
            </h2>

            {acceptedJobs.filter((j) => !j.receipt).length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">ไม่มีใบงานที่รอออกใบแจ้งหนี้</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acceptedJobs
                  .filter((j) => !j.receipt)
                  .map((job) => (
                    <Card key={job.id} className="shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{job.customer?.customerName}</CardTitle>
                            <CardDescription>{job.jobAddress}</CardDescription>
                          </div>
                          <Badge variant="success">ตรวจรับแล้ว (ACCEPTED)</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">ยอดเงินตามใบเสนอราคา:</span>
                          <span className="font-bold">{job.quotation ? Number(job.quotation.totalAmount).toLocaleString() : 0} บาท</span>
                        </div>
                        <div className="pt-2 border-t flex justify-end">
                          <Button
                            size="sm"
                            onClick={() => handleIssueInvoice(job.id)}
                            disabled={actionLoading === job.id}
                            className="gap-1.5"
                          >
                            {actionLoading === job.id && <Loader2 className="h-4 w-4 animate-spin" />}
                            <Receipt className="h-4 w-4" /> ออกใบแจ้งหนี้ (Invoice)
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            )}
          </div>

          {/* Section 2: All Issued Invoices / Receipts */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" />
              รายการใบแจ้งหนี้และใบเสร็จทั้งหมดในระบบ
            </h2>

            {receipts.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">ยังไม่มีรายการใบแจ้งหนี้ในระบบ</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {receipts.map((rec) => (
                  <Card key={rec.id} className="shadow-sm">
                    <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{rec.job.customer.customerName}</span>
                          <Badge variant={rec.status === "PAID" ? "success" : "warning"}>
                            {rec.status === "PAID" ? "ชำระเงินแล้ว (PAID)" : "รอชำระเงิน (UNPAID)"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">ที่อยู่: {rec.job.jobAddress}</p>
                        <p className="text-xs text-muted-foreground">วันที่ออก: {new Date(rec.createdAt).toLocaleDateString("th-TH")} | ประเภทงาน: {rec.job.jobType}</p>
                      </div>
                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">ยอดรวมทั้งสิ้น</p>
                          <p className="text-base font-bold">{Number(rec.totalAmount).toLocaleString()} บาท</p>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/accountant/invoices/${rec.id}`}>
                            ดูรายละเอียด
                          </Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
