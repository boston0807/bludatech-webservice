// src/app/admin/service-history/page.tsx
// UC17 — ธุรการ (Admin) ตรวจสอบใบงานที่ชำระเงินแล้ว และอนุมัติบันทึกประวัติการให้บริการ
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Wrench, Settings, MapPin, Phone, CreditCard, ClipboardCheck, CheckCircle2, Clock, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EMPTY_FILTERS,
  FilterBar,
  Pagination,
  filtersToQuery,
  useDebounced,
  usePagination,
  type ListFilters,
} from "@/components/ui/list-controls";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Payment = { id: string; paymentDate: string; amount: string; paymentMethod: string };
type Job = {
  id: string;
  jobType: "INSTALLATION" | "REPAIR" | "SERVICE";
  jobAddress: string;
  jobNote: string | null;
  requestDate: string;
  customer?: { customerName: string; customerPhone: string };
  quotation?: { totalAmount: string } | null;
  receipt?: { id: string; totalAmount: string; status: string; payments: Payment[] } | null;
};
type Draft = { summary: string; technicianNames: string };

const JOB_TYPE_ICON = { INSTALLATION: Building2, REPAIR: Wrench, SERVICE: Settings };
const JOB_TYPE_LABEL = { INSTALLATION: "ติดตั้งลิฟต์", REPAIR: "ซ่อมรายครั้ง", SERVICE: "บำรุงรักษา" };
const PAYMENT_METHOD_LABEL: Record<string, string> = {
  TRANSFER: "โอนเงินผ่านธนาคาร",
  CASH: "เงินสด",
  CREDIT_CARD: "บัตรเครดิต",
};

const baht = (v?: string | null) =>
  Number(v ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2 }) + " บาท";

const TYPE_OPTIONS = [
  { value: "INSTALLATION", label: "ติดตั้งลิฟต์" },
  { value: "REPAIR", label: "ซ่อมรายครั้ง" },
  { value: "SERVICE", label: "บำรุงรักษา" },
];

export default function ServiceHistoryApprovalPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [filters, setFilters] = useState<ListFilters>(EMPTY_FILTERS);
  const query = filtersToQuery(useDebounced(filters), { status: "PAID" });
  const { pageItems, ...pager } = usePagination(jobs, 10);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/jobs${query}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setJobs(data.data);
        setDrafts(Object.fromEntries(
          (data.data as Job[]).map((j) => [
            j.id,
            {
              summary: j.jobNote ?? "",
              technicianNames: "",
            },
          ])
        ));
      } else {
        showToast(data.message ?? "โหลดข้อมูลไม่สำเร็จ", "error");
      }
    } catch {
      showToast("ไม่สามารถเชื่อมต่อ server ได้", "error");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const setDraft = (jobId: string, field: keyof Draft, value: string) =>
    setDrafts((prev) => ({ ...prev, [jobId]: { ...prev[jobId], [field]: value } }));

  const handleApprove = async (jobId: string) => {
    setSavingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(drafts[jobId] ?? {}),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast(data.message ?? "บันทึกประวัติการให้บริการสำเร็จ", "success");
        setJobs((prev) => prev.filter((j) => j.id !== jobId));
      } else {
        showToast(data.message ?? "เกิดข้อผิดพลาด", "error");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg text-white text-sm font-medium ${
            toast.type === "success" ? "bg-green-600" : "bg-destructive"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">บันทึกประวัติการให้บริการ</h1>
          <p className="text-muted-foreground">ตรวจสอบใบงานที่ลูกค้าชำระเงินแล้ว และอนุมัติบันทึกประวัติเพื่อปิดงาน</p>
        </div>
        <Badge variant="warning" className="text-sm px-3 py-1">
          <Clock className="h-3.5 w-3.5 mr-1" />
          รอบันทึก {jobs.length} งาน
        </Badge>
      </div>

      <FilterBar
        value={filters}
        onChange={setFilters}
        searchPlaceholder="ค้นหาชื่อลูกค้า เบอร์โทร ที่อยู่ หรือเลขที่ใบงาน"
        jobTypeOptions={TYPE_OPTIONS}
        dateLabel="วันที่ยื่นคำขอ"
      />

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-lg font-medium">ไม่มีใบงานที่รอบันทึกประวัติ</p>
            <p className="text-muted-foreground text-sm">ใบงานที่ลูกค้าชำระเงินแล้วจะแสดงที่นี่</p>
          </CardContent>
        </Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="grid gap-4">
          {pageItems.map((job) => {
            const Icon = JOB_TYPE_ICON[job.jobType];
            const payment = job.receipt?.payments?.[0];
            const draft = drafts[job.id] ?? { summary: "", technicianNames: "" };
            const saving = savingId === job.id;
            return (
              <Card key={job.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{JOB_TYPE_LABEL[job.jobType]}</CardTitle>
                        <CardDescription>{job.customer?.customerName ?? "-"}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="success">ชำระเงินแล้ว รอบันทึกประวัติ</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-start gap-2 text-muted-foreground md:col-span-2">
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span>{job.jobAddress}</span>
                    </div>
                    {job.customer?.customerPhone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="h-4 w-4 flex-shrink-0" />
                        <span>{job.customer.customerPhone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <CreditCard className="h-4 w-4 flex-shrink-0" />
                      <span>
                        {payment
                          ? `${PAYMENT_METHOD_LABEL[payment.paymentMethod] ?? payment.paymentMethod} • ${new Date(
                              payment.paymentDate
                            ).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" })}`
                          : "ไม่มีข้อมูลการชำระเงิน"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <span className="text-sm text-muted-foreground">ยอดที่ชำระแล้ว</span>
                    <span className="text-lg font-bold text-primary">
                      {baht(job.receipt?.totalAmount ?? job.quotation?.totalAmount)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor={`tech-${job.id}`}>ช่างผู้ปฏิบัติงาน</Label>
                      <Input
                        id={`tech-${job.id}`}
                        placeholder="เช่น สมชาย ใจดี, วิชัย ช่างดี (ว่างไว้ = ช่างที่ได้รับมอบหมายในแผนงาน)"
                        value={draft.technicianNames}
                        onChange={(e) => setDraft(job.id, "technicianNames", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`summary-${job.id}`}>สรุปการให้บริการ</Label>
                      <Input
                        id={`summary-${job.id}`}
                        placeholder="สรุปงานที่ทำ (ว่างไว้ = บริการเสร็จสิ้นสมบูรณ์)"
                        value={draft.summary}
                        onChange={(e) => setDraft(job.id, "summary", e.target.value)}
                        disabled={saving}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-1 border-t">
                    <Button onClick={() => handleApprove(job.id)} disabled={saving} className="mt-3 gap-2">
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
                      อนุมัติและบันทึกประวัติ
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          <Pagination {...pager} onPage={pager.setPage} />
        </div>
      )}
    </div>
  );
}
