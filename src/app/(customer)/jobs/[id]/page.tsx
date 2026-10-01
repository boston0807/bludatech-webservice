// src/app/(customer)/jobs/[id]/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2,
  Building2,
  Wrench,
  Settings,
  ChevronLeft,
  CheckCircle2,
  Circle,
  MapPin,
  FileText,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Types ────────────────────────────────────────────────────────────────────

type Expense = {
  id: number;
  expenseName: string;
  quantity: number;
  price: string;
};

type Quotation = {
  id: string;
  totalAmount: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  rejectNote: string | null;
  createdAt: string;
};

type WorkPlan = {
  id: string;
  startDate: string;
  endDate: string;
  location: string | null;
  status: string;
  materials?: {
    quantity: number;
    material: { materialName: string };
  }[];
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
    elevatorType: string | null;
    quantity: number;
  };
  repair?: { elevatorModel: string | null; quantity: number };
  service?: { elevatorModel: string | null; quantity: number };
  expenses: Expense[];
  quotation: Quotation | null;
  workPlan: WorkPlan | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอดำเนินการ",
  PASS_SURVEY: "สำรวจแล้ว",
  QUOTED: "มีใบเสนอราคา",
  REQUEST_EDIT: "ขอแก้ไข",
  APPROVE: "อนุมัติแล้ว",
  PLAN_APPROVED: "แผนงานอนุมัติ",
  IN_PROGRESS: "กำลังดำเนินการ",
  WAITING_ACCEPTANCE: "รอตรวจรับงาน",
  ACCEPTED: "ตรวจรับแล้ว",
  PAID: "ชำระเงินแล้ว",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "warning" | "success" | "destructive" | "outline"
> = {
  PENDING: "warning",
  PASS_SURVEY: "secondary",
  QUOTED: "default",
  REQUEST_EDIT: "warning",
  APPROVE: "success",
  PLAN_APPROVED: "success",
  IN_PROGRESS: "default",
  WAITING_ACCEPTANCE: "warning",
  ACCEPTED: "success",
  PAID: "success",
  COMPLETED: "success",
  CANCELLED: "destructive",
};

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

// Timeline steps
const TIMELINE_STEPS = [
  { key: "PENDING", label: "ยื่นคำขอ" },
  { key: "PASS_SURVEY", label: "สำรวจแล้ว" },
  { key: "QUOTED", label: "ใบเสนอราคา" },
  { key: "APPROVE", label: "อนุมัติ" },
  { key: "PLAN_APPROVED", label: "อนุมัติแผน" },
  { key: "IN_PROGRESS", label: "ดำเนินการ" },
  { key: "WAITING_ACCEPTANCE", label: "รอตรวจรับ" },
  { key: "ACCEPTED", label: "ตรวจรับแล้ว" },
  { key: "PAID", label: "ชำระเงิน" },
];

const STATUS_ORDER = TIMELINE_STEPS.map((s) => s.key);

function getStepStatus(stepKey: string, currentStatus: string) {
  if (currentStatus === "CANCELLED") return "cancelled";
  const stepIdx = STATUS_ORDER.indexOf(stepKey);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  if (stepIdx < currentIdx) return "done";
  if (stepIdx === currentIdx) return "current";
  return "pending";
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CustomerJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quotation action state
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);

  const fetchJob = () => {
    setLoading(true);
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setJob(d.data);
        else setError(d.message ?? "โหลดข้อมูลไม่สำเร็จ");
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleQuotationAction = async (
    action: "APPROVE" | "REJECT" | "CANCEL"
  ) => {
    if (!job?.quotation) return;
    if (action === "REJECT" && !rejectNote.trim()) {
      setActionError("กรุณาระบุเหตุผลที่ปฏิเสธ");
      return;
    }

    setActionLoading(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const res = await fetch(`/api/quotations/${job.quotation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          ...(action === "REJECT" && { rejectNote }),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message ?? "เกิดข้อผิดพลาด");
        return;
      }

      const messages: Record<string, string> = {
        APPROVE: "อนุมัติใบเสนอราคาสำเร็จ",
        REJECT: "ปฏิเสธใบเสนอราคาสำเร็จ",
        CANCEL: "ยกเลิกคำขอบริการสำเร็จ",
      };
      setActionSuccess(messages[action]);
      fetchJob();
      setShowRejectForm(false);
      setRejectNote("");
    } catch {
      setActionError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAcceptance = async () => {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/jobs/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ACCEPTED" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message ?? "เกิดข้อผิดพลาด");
        return;
      }
      setActionSuccess("ตรวจรับงานสำเร็จ");
      fetchJob();
    } catch {
      setActionError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveWorkPlan = async () => {
    if (!job?.workPlan) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/workplans/${job.workPlan.id}/approve`, {
        method: "PATCH",
      });
      const data = await res.json();
      if (!res.ok) {
        setActionError(data.message ?? "เกิดข้อผิดพลาด");
        return;
      }
      setActionSuccess("อนุมัติแผนการทำงานสำเร็จ");
      fetchJob();
    } catch {
      setActionError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="text-center py-20 space-y-4">
        <p className="text-muted-foreground">{error ?? "ไม่พบใบงาน"}</p>
        <Link href="/jobs">
          <Button variant="outline">กลับไปรายการใบงาน</Button>
        </Link>
      </div>
    );
  }

  const Icon = JOB_TYPE_ICON[job.jobType];
  const expenseTotal = job.expenses.reduce(
    (sum, e) => sum + parseFloat(e.price) * e.quantity,
    0
  );

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back + Header */}
      <div>
        <Link
          href="/jobs"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-3"
        >
          <ChevronLeft className="h-4 w-4" />
          กลับไปรายการใบงาน
        </Link>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 rounded-full p-3">
              <Icon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {JOB_TYPE_LABEL[job.jobType]}
              </h1>
              <p className="text-muted-foreground text-sm flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                {job.jobAddress}
              </p>
            </div>
          </div>
          <Badge variant={STATUS_VARIANT[job.status] ?? "outline"} className="mt-1">
            {STATUS_LABEL[job.status] ?? job.status}
          </Badge>
        </div>
      </div>

      {/* Success / Error messages */}
      {actionSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          {actionSuccess}
        </div>
      )}
      {actionError && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
          {actionError}
        </div>
      )}

      {/* Status Timeline */}
      {job.status !== "CANCELLED" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">สถานะใบงาน</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-0 overflow-x-auto pb-2">
              {TIMELINE_STEPS.map((step, idx) => {
                const status = getStepStatus(step.key, job.status);
                return (
                  <div key={step.key} className="flex items-center flex-shrink-0">
                    <div className="flex flex-col items-center gap-1 min-w-[60px]">
                      {status === "done" ? (
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                      ) : status === "current" ? (
                        <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                          <div className="h-2 w-2 rounded-full bg-white" />
                        </div>
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground/40" />
                      )}
                      <span
                        className={`text-[10px] text-center leading-tight ${
                          status === "current"
                            ? "text-primary font-semibold"
                            : status === "done"
                            ? "text-green-600"
                            : "text-muted-foreground/50"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                    {idx < TIMELINE_STEPS.length - 1 && (
                      <div
                        className={`h-0.5 w-4 flex-shrink-0 mx-0.5 ${
                          STATUS_ORDER.indexOf(step.key) <
                          STATUS_ORDER.indexOf(job.status)
                            ? "bg-green-400"
                            : "bg-muted-foreground/20"
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {job.status === "CANCELLED" && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive rounded-md px-4 py-3 text-sm font-medium">
          ใบงานนี้ถูกยกเลิกแล้ว
        </div>
      )}

      {/* Job Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">รายละเอียดงาน</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
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
            <div>
              <p className="text-muted-foreground text-xs">ประเภทงาน</p>
              <p className="font-medium">{JOB_TYPE_LABEL[job.jobType]}</p>
            </div>

            {/* Installation specific */}
            {job.installation && (
              <>
                <div>
                  <p className="text-muted-foreground text-xs">จำนวนชั้นอาคาร</p>
                  <p className="font-medium">{job.installation.buildingFloor} ชั้น</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">จำนวนเครื่อง</p>
                  <p className="font-medium">{job.installation.quantity} เครื่อง</p>
                </div>
                {job.installation.elevatorBrand && (
                  <div>
                    <p className="text-muted-foreground text-xs">ยี่ห้อลิฟต์</p>
                    <p className="font-medium">{job.installation.elevatorBrand}</p>
                  </div>
                )}
                {job.installation.elevatorModel && (
                  <div>
                    <p className="text-muted-foreground text-xs">รุ่นลิฟต์</p>
                    <p className="font-medium">{job.installation.elevatorModel}</p>
                  </div>
                )}
                {job.installation.elevatorType && (
                  <div>
                    <p className="text-muted-foreground text-xs">ประเภทลิฟต์</p>
                    <p className="font-medium">{job.installation.elevatorType}</p>
                  </div>
                )}
              </>
            )}

            {/* Repair specific */}
            {job.repair && (
              <>
                {job.repair.elevatorModel && (
                  <div>
                    <p className="text-muted-foreground text-xs">รุ่นลิฟต์</p>
                    <p className="font-medium">{job.repair.elevatorModel}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">จำนวนเครื่อง</p>
                  <p className="font-medium">{job.repair.quantity} เครื่อง</p>
                </div>
              </>
            )}

            {/* Service specific */}
            {job.service && (
              <>
                {job.service.elevatorModel && (
                  <div>
                    <p className="text-muted-foreground text-xs">รุ่นลิฟต์</p>
                    <p className="font-medium">{job.service.elevatorModel}</p>
                  </div>
                )}
                <div>
                  <p className="text-muted-foreground text-xs">จำนวนเครื่อง</p>
                  <p className="font-medium">{job.service.quantity} เครื่อง</p>
                </div>
              </>
            )}
          </div>

          {job.jobNote && (
            <div className="pt-2 border-t">
              <p className="text-muted-foreground text-xs mb-1">หมายเหตุ</p>
              <p className="text-sm">{job.jobNote}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Expenses Table */}
      {job.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              รายการค่าใช้จ่าย (ประมาณการ)
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                      {(parseFloat(expense.price) * expense.quantity).toLocaleString(
                        "th-TH",
                        { minimumFractionDigits: 2 }
                      )}{" "}
                      บาท
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td colSpan={3} className="pt-3 text-right">
                    รวมค่าอะไหล่/วัสดุ
                  </td>
                  <td className="pt-3 text-right">
                    {expenseTotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}{" "}
                    บาท
                  </td>
                </tr>
              </tfoot>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Quotation Section */}
      {job.quotation && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              ใบเสนอราคา
            </CardTitle>
            <CardDescription>
              ออกเมื่อ{" "}
              {new Date(job.quotation.createdAt).toLocaleDateString("th-TH", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">ยอดรวมทั้งสิ้น</span>
              <span className="text-2xl font-bold text-primary">
                {parseFloat(job.quotation.totalAmount).toLocaleString("th-TH", {
                  minimumFractionDigits: 2,
                })}{" "}
                บาท
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">สถานะ:</span>
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
            </div>

            {job.quotation.rejectNote && (
              <div className="bg-destructive/10 border border-destructive/20 rounded-md px-3 py-2 text-sm">
                <span className="font-medium text-destructive">เหตุผล: </span>
                {job.quotation.rejectNote}
              </div>
            )}

            {/* Action buttons — show only when job is QUOTED and quotation is PENDING */}
            {job.status === "QUOTED" && job.quotation.status === "PENDING" && (
              <div className="space-y-3 pt-2 border-t">
                <p className="text-sm text-muted-foreground">
                  กรุณาตรวจสอบใบเสนอราคาและดำเนินการ
                </p>

                {!showRejectForm ? (
                  <div className="flex gap-3">
                    <Button
                      onClick={() => handleQuotationAction("APPROVE")}
                      disabled={actionLoading}
                      className="flex-1"
                    >
                      {actionLoading && (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                      ✓ อนุมัติ
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowRejectForm(true)}
                      disabled={actionLoading}
                    >
                      ✗ ปฏิเสธ
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleQuotationAction("CANCEL")}
                      disabled={actionLoading}
                    >
                      ยกเลิกคำขอ
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="rejectNote">เหตุผลที่ปฏิเสธ</Label>
                      <Input
                        id="rejectNote"
                        placeholder="กรุณาระบุเหตุผล..."
                        value={rejectNote}
                        onChange={(e) => setRejectNote(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3">
                      <Button
                        variant="destructive"
                        onClick={() => handleQuotationAction("REJECT")}
                        disabled={actionLoading || !rejectNote.trim()}
                      >
                        {actionLoading && (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        )}
                        ยืนยันการปฏิเสธ
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowRejectForm(false);
                          setRejectNote("");
                        }}
                        disabled={actionLoading}
                      >
                        ยกเลิก
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Work Plan Section */}
      {job.workPlan && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" /> แผนการปฏิบัติงาน
            </CardTitle>
            <CardDescription>
              กำหนดการปฏิบัติงานและรายการอะไหล่ที่จอง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <p className="font-medium">
                วันที่: {new Date(job.workPlan.startDate).toLocaleDateString("th-TH")} {job.workPlan.endDate ? `ถึง ${new Date(job.workPlan.endDate).toLocaleDateString("th-TH")}` : ""}
              </p>
              <p className="text-muted-foreground">สถานที่: {job.workPlan.location || job.jobAddress}</p>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">สถานะแผน:</span>
                <Badge variant={job.workPlan.status === "APPROVED" || job.status === "PLAN_APPROVED" ? "success" : "warning"}>
                  {job.workPlan.status === "APPROVED" || job.status === "PLAN_APPROVED" ? "อนุมัติแล้ว" : "รออนุมัติแผน"}
                </Badge>
              </div>

              {job.workPlan.materials && job.workPlan.materials.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">รายการอะไหล่/วัสดุที่ใช้ตามแผน:</p>
                  <ul className="space-y-1 text-xs">
                    {job.workPlan.materials.map((m, idx) => (
                      <li key={idx} className="flex justify-between bg-muted px-2 py-1 rounded">
                        <span>{m.material.materialName}</span>
                        <span>จำนวน: {m.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Customer Approve Work Plan Button */}
            {job.workPlan.status === "DRAFT" && (
              <div className="pt-2 border-t flex justify-end">
                <Button onClick={handleApproveWorkPlan} disabled={actionLoading} className="gap-2">
                  {actionLoading && <Loader2 className="h-4 w-4 animate-spin" />}
                  ✓ อนุมัติแผนการทำงาน
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invoice / Payment Link */}
      {["WAITING_ACCEPTANCE", "ACCEPTED", "PAID"].includes(job.status) && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">ใบแจ้งหนี้ / การชำระเงิน</p>
                <p className="text-sm text-muted-foreground">ตรวจสอบใบแจ้งหนี้และชำระค่าบริการ</p>
              </div>
              <Link href={`/jobs/${job.id}/invoice`}>
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" /> ดูใบแจ้งหนี้ / ชำระเงิน
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ตรวจรับงาน button */}
      {job.status === "WAITING_ACCEPTANCE" && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">ตรวจรับงาน</p>
                <p className="text-sm text-muted-foreground">
                  งานเสร็จสิ้นแล้ว กรุณาตรวจสอบและยืนยันการรับงาน
                </p>
              </div>
              <Button
                onClick={handleAcceptance}
                disabled={actionLoading}
                className="gap-2"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardCheck className="h-4 w-4" />
                )}
                ตรวจรับงาน
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
