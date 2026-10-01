// src/app/accountant/quotations/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  ChevronLeft,
  Building2,
  Wrench,
  Settings,
  FileText,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────────────────────────────────────────────

type Expense = {
  id: number;
  expenseName: string;
  quantity: number;
  price: string;
};

type Job = {
  id: string;
  jobType: "INSTALLATION" | "REPAIR" | "SERVICE";
  jobAddress: string;
  jobNote: string | null;
  jobWage: string;
  status: string;
  requestDate: string;
  customer: {
    customerName: string;
    customerPhone: string;
    customerEmail: string | null;
    customerAddress: string;
  };
  installation?: {
    buildingFloor: number;
    elevatorBrand: string | null;
    elevatorModel: string | null;
    quantity: number;
  };
  repair?: { elevatorModel: string | null; quantity: number };
  service?: { elevatorModel: string | null; quantity: number };
  expenses: Expense[];
  quotation: { id: string; totalAmount: string; status: string } | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const JOB_TYPE_LABEL = {
  INSTALLATION: "ติดตั้งลิฟต์",
  REPAIR: "ซ่อมรายครั้ง",
  SERVICE: "บำรุงรักษา",
};

const JOB_TYPE_ICON = {
  INSTALLATION: Building2,
  REPAIR: Wrench,
  SERVICE: Settings,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function CreateQuotationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [jobWage, setJobWage] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch job detail (includes expenses via the job detail endpoint)
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setJob(d.data);
          // Pre-fill job wage from existing value
          if (d.data.jobWage) {
            setJobWage(parseFloat(d.data.jobWage).toString());
          }
        } else {
          setFetchError(d.message ?? "โหลดข้อมูลไม่สำเร็จ");
        }
      })
      .catch(() => setFetchError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (fetchError || !job) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">{fetchError ?? "ไม่พบใบงาน"}</p>
        <Link href="/accountant/quotations">
          <Button variant="outline">กลับ</Button>
        </Link>
      </div>
    );
  }

  // Already has a quotation
  if (job.quotation) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <Link
            href="/accountant/quotations"
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
          >
            <ChevronLeft className="h-4 w-4" />
            กลับไปรายการ
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">ใบเสนอราคา</h1>
        </div>
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-3 text-green-700">
              <CheckCircle2 className="h-6 w-6" />
              <p className="font-medium">ใบงานนี้มีใบเสนอราคาแล้ว</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">ยอดรวม</span>
              <span className="text-xl font-bold">
                {parseFloat(job.quotation.totalAmount).toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                })}{" "}
                บาท
              </span>
            </div>
            <Badge
              variant={
                job.quotation.status === "APPROVED"
                  ? "success"
                  : job.quotation.status === "REJECTED"
                  ? "destructive"
                  : "warning"
              }
            >
              {job.quotation.status === "APPROVED"
                ? "อนุมัติแล้ว"
                : job.quotation.status === "REJECTED"
                ? "ปฏิเสธแล้ว"
                : "รออนุมัติ"}
            </Badge>
            <Link href="/accountant/quotations">
              <Button variant="outline" className="w-full mt-2">
                กลับไปรายการ
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const expenseSubtotal = job.expenses.reduce(
    (sum, e) => sum + parseFloat(e.price) * e.quantity,
    0
  );
  const wage = parseFloat(jobWage) || 0;
  const totalAmount = expenseSubtotal + wage;

  const Icon = JOB_TYPE_ICON[job.jobType];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wage < 0) {
      setSubmitError("ค่าแรงต้องไม่ติดลบ");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch(`/api/jobs/${id}/quotation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ totalAmount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.message ?? "เกิดข้อผิดพลาด");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.push("/accountant/quotations"), 1500);
    } catch {
      setSubmitError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/accountant/quotations"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับไปรายการ
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">จัดทำใบเสนอราคา</h1>
        <p className="text-muted-foreground">
          กรอกข้อมูลและยืนยันยอดรวมเพื่อส่งใบเสนอราคาให้ลูกค้า
        </p>
      </div>

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          สร้างใบเสนอราคาสำเร็จ กำลังกลับไปหน้ารายการ...
        </div>
      )}

      {/* Job Info */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-full p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">
                {JOB_TYPE_LABEL[job.jobType]}
              </CardTitle>
              <CardDescription>{job.jobAddress}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Customer info */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              ข้อมูลลูกค้า
            </p>
            <p className="font-medium">{job.customer.customerName}</p>
            <p className="text-sm text-muted-foreground">
              {job.customer.customerPhone}
            </p>
            {job.customer.customerEmail && (
              <p className="text-sm text-muted-foreground">
                {job.customer.customerEmail}
              </p>
            )}
            <p className="text-sm text-muted-foreground">
              {job.customer.customerAddress}
            </p>
          </div>

          {/* Job details */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-muted-foreground text-xs">วันที่ยื่นคำขอ</p>
              <p className="font-medium">
                {new Date(job.requestDate).toLocaleDateString("th-TH", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
            {job.installation && (
              <div>
                <p className="text-muted-foreground text-xs">จำนวนชั้นอาคาร</p>
                <p className="font-medium">
                  {job.installation.buildingFloor} ชั้น
                </p>
              </div>
            )}
            {(job.installation?.elevatorModel ||
              job.repair?.elevatorModel ||
              job.service?.elevatorModel) && (
              <div>
                <p className="text-muted-foreground text-xs">รุ่นลิฟต์</p>
                <p className="font-medium">
                  {job.installation?.elevatorModel ??
                    job.repair?.elevatorModel ??
                    job.service?.elevatorModel}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Expenses Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            รายการค่าอะไหล่ / วัสดุ
          </CardTitle>
          <CardDescription>
            รายการที่ช่างเทคนิคประเมินไว้จากการสำรวจหน้างาน
          </CardDescription>
        </CardHeader>
        <CardContent>
          {job.expenses.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              ไม่มีรายการค่าอะไหล่
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground text-xs">
                  <th className="text-left pb-2">รายการ</th>
                  <th className="text-center pb-2">จำนวน</th>
                  <th className="text-right pb-2">ราคา/หน่วย</th>
                  <th className="text-right pb-2">รวม</th>
                </tr>
              </thead>
              <tbody>
                {job.expenses.map((expense) => (
                  <tr key={expense.id} className="border-b last:border-0">
                    <td className="py-2">{expense.expenseName}</td>
                    <td className="py-2 text-center">{expense.quantity}</td>
                    <td className="py-2 text-right">
                      {parseFloat(expense.price).toLocaleString("th-TH", {
                        minimumFractionDigits: 2,
                      })}{" "}
                      บาท
                    </td>
                    <td className="py-2 text-right">
                      {(
                        parseFloat(expense.price) * expense.quantity
                      ).toLocaleString("th-TH", { minimumFractionDigits: 2 })}{" "}
                      บาท
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="text-muted-foreground">
                  <td colSpan={3} className="pt-3 text-right text-xs">
                    รวมค่าอะไหล่/วัสดุ
                  </td>
                  <td className="pt-3 text-right font-medium">
                    {expenseSubtotal.toLocaleString("th-TH", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    บาท
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Quotation Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">คำนวณยอดรวม</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Job Wage Input */}
            <div className="space-y-2">
              <Label htmlFor="jobWage">
                ค่าแรง (บาท) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="jobWage"
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={jobWage}
                onChange={(e) => setJobWage(e.target.value)}
              />
            </div>

            {/* Summary */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">ค่าอะไหล่/วัสดุ</span>
                <span>
                  {expenseSubtotal.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  บาท
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ค่าแรง</span>
                <span>
                  {wage.toLocaleString("th-TH", { minimumFractionDigits: 2 })}{" "}
                  บาท
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-bold text-base">
                <span>ยอดรวมทั้งสิ้น</span>
                <span className="text-primary">
                  {totalAmount.toLocaleString("th-TH", {
                    minimumFractionDigits: 2,
                  })}{" "}
                  บาท
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {submitError && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
            {submitError}
          </div>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={submitting || success} className="flex-1">
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            ยืนยันและส่งใบเสนอราคา
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/accountant/quotations")}
            disabled={submitting}
          >
            ยกเลิก
          </Button>
        </div>
      </form>
    </div>
  );
}
