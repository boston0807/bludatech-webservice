// src/app/accountant/invoices/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Receipt, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import Link from "next/link";
import { JOB_TYPE_LABEL, RECEIPT_STATUS_LABEL } from "@/lib/labels";
import {
  EMPTY_FILTERS,
  FilterBar,
  Pagination,
  filtersToQuery,
  useDebounced,
  usePagination,
  type ListFilters,
} from "@/components/ui/list-controls";
import { downloadCsv, csvDate } from "@/lib/csv";

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
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  const [listLoading, setListLoading] = useState(false);
  const query = filtersToQuery(useDebounced(filters));
  const { pageItems, ...pager } = usePagination(receipts, 10);

  const loadReceipts = () => {
    setListLoading(true);
    return fetch(`/api/invoices${query}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setReceipts(d.data);
        else setError(d.message ?? "โหลดรายการใบแจ้งหนี้ไม่สำเร็จ");
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการโหลดข้อมูล"))
      .finally(() => setListLoading(false));
  };

  const loadJobs = () =>
    fetch("/api/jobs?status=ACCEPTED")
      .then((r) => r.json())
      .then((jobsRes) => {
        if (jobsRes.success) setAcceptedJobs(jobsRes.data);
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการโหลดข้อมูล"))
      .finally(() => setLoading(false));

  // โหลดใหม่ทั้งสองส่วนหลังออกใบแจ้งหนี้
  const loadData = () => {
    loadJobs();
    loadReceipts();
  };

  useEffect(() => {
    loadJobs();
  }, []);

  // รายการใบแจ้งหนี้โหลดตามตัวกรอง (รวมครั้งแรกด้วย)
  useEffect(() => {
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const exportCsv = () => {
    downloadCsv(
      `invoices-${csvDate(new Date())}`,
      ["เลขที่ใบแจ้งหนี้", "เลขที่ใบงาน", "วันที่ออก", "ลูกค้า", "เบอร์โทร", "ประเภทงาน", "ที่อยู่", "สถานะ", "ยอดรวม (บาท)", "ชำระแล้ว (บาท)", "วันที่ชำระ"],
      receipts.map((r) => [
        r.id,
        r.jobId,
        csvDate(r.createdAt),
        r.job.customer.customerName,
        r.job.customer.customerPhone,
        JOB_TYPE_LABEL[r.job.jobType] ?? r.job.jobType,
        r.job.jobAddress,
        RECEIPT_STATUS_LABEL[r.status] ?? r.status,
        Number(r.totalAmount).toFixed(2),
        r.payments.reduce((s, p) => s + Number(p.amount), 0).toFixed(2),
        r.payments.map((p) => csvDate(p.paymentDate)).join(" "),
      ])
    );
  };

  const handleIssueInvoice = async (jobId: string) => {
    setActionLoading(jobId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/invoice`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(data.message ?? "ส่งใบแจ้งหนี้ให้ลูกค้าแล้ว");
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
        <h1 className="text-2xl font-bold tracking-tight">ออกใบแจ้งหนี้และชำระเงิน</h1>
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
              ใบแจ้งหนี้ที่ระบบออกให้อัตโนมัติ รอตรวจสอบก่อนส่งลูกค้า
            </h2>
            <p className="text-sm text-muted-foreground -mt-2">
              ระบบสร้างใบแจ้งหนี้ร่างจากยอดใบเสนอราคาที่อนุมัติทันทีที่ลูกค้าตรวจรับงาน ตรวจความถูกต้องแล้วกดยืนยันเพื่อส่งให้ลูกค้าชำระ
            </p>

            {acceptedJobs.filter((j) => j.status === "ACCEPTED" && (!j.receipt || j.receipt.status === "DRAFT")).length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground text-sm">ไม่มีใบแจ้งหนี้ที่รอตรวจสอบ</CardContent></Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {acceptedJobs
                  .filter((j) => j.status === "ACCEPTED" && (!j.receipt || j.receipt.status === "DRAFT"))
                  .map((job) => (
                    <Card key={job.id} className="shadow-sm">
                      <CardHeader className="pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-base">{job.customer?.customerName}</CardTitle>
                            <CardDescription>{job.jobAddress}</CardDescription>
                          </div>
                          <Badge variant="warning">{job.receipt ? "ใบร่าง รอตรวจสอบ" : "ยังไม่มีใบแจ้งหนี้"}</Badge>
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
                            <Receipt className="h-4 w-4" /> {job.receipt ? "ตรวจสอบแล้ว ส่งให้ลูกค้า" : "ออกใบแจ้งหนี้"}
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Receipt className="h-5 w-5 text-primary" />
                รายการใบแจ้งหนี้และใบเสร็จทั้งหมดในระบบ
              </h2>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link href="/accountant/receivables">ลูกหนี้ค้างชำระ</Link>
                </Button>
                <Button size="sm" variant="outline" onClick={exportCsv} disabled={receipts.length === 0}>
                  <Download className="h-4 w-4" /> Export CSV
                </Button>
              </div>
            </div>

            <FilterBar
              value={filters}
              onChange={setFilters}
              searchPlaceholder="ค้นหาชื่อลูกค้า ที่อยู่ หรือเลขที่"
              statusOptions={Object.entries(RECEIPT_STATUS_LABEL).map(([value, label]) => ({ value, label }))}
              jobTypeOptions={Object.entries(JOB_TYPE_LABEL).map(([value, label]) => ({ value, label }))}
              dateLabel="วันที่ออก"
            />

            {listLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : receipts.length === 0 ? (
              <Card><CardContent className="py-12 text-center text-muted-foreground">ไม่พบรายการใบแจ้งหนี้</CardContent></Card>
            ) : (
              <div className="space-y-3">
                {pageItems.map((rec) => (
                  <Card key={rec.id} className="shadow-sm">
                    <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-base">{rec.job.customer.customerName}</span>
                          <Badge variant={rec.status === "PAID" ? "success" : rec.status === "DRAFT" ? "secondary" : "warning"}>
                            {RECEIPT_STATUS_LABEL[rec.status] ?? rec.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">ที่อยู่: {rec.job.jobAddress}</p>
                        <p className="text-xs text-muted-foreground">วันที่ออก: {new Date(rec.createdAt).toLocaleDateString("th-TH")} | ประเภทงาน: {JOB_TYPE_LABEL[rec.job.jobType] ?? rec.job.jobType}</p>
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
                <Pagination {...pager} onPage={pager.setPage} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
