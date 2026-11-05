// src/app/technician/workplans/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  Building2,
  Wrench,
  Settings,
  Calendar,
  ShieldCheck,
  Play,
  Users,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  PackageX,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SAFETY_CHECKLIST } from "@/lib/safety-checklist";
import {
  JOB_TYPE_LABEL,
  JOB_STATUS_LABEL,
  PLAN_STATUS_LABEL,
  PLAN_STATUS_VARIANT,
  ROLE_LABEL,
  thDate,
  thDateRange,
  toDateInput,
  dateInputToIso,
} from "@/lib/labels";

type Material = { id: string; materialName: string; stockQuantity: number };

type Technician = {
  id: string;
  employeeName: string;
  role: string;
  available: boolean;
  activePlans: number;
  conflicts: { jobId: string; jobAddress: string; startDate: string; endDate: string }[];
};

type SafetyItem = { key: string; label: string; passed: boolean; remark: string | null };

type Job = {
  id: string;
  jobType: "INSTALLATION" | "REPAIR" | "SERVICE";
  jobAddress: string;
  status: string;
  reworkNote: string | null;
  customer?: { customerName: string; customerPhone: string };
  workPlan?: {
    id: string;
    startDate: string;
    endDate: string;
    location?: string | null;
    status: string;
    rejectNote: string | null;
    materials: { materialId: string; quantity: number; material: { materialName: string; stockQuantity: number } }[];
    technicians: { employeeId: string; employee: { id: string; employeeName: string; role: string } }[];
  } | null;
  safetyChecks?: { id: string; passed: boolean; items: SafetyItem[]; note: string | null; checkedAt: string }[];
};

type Shortage = { id: string; materialName: string; shortageQty: number };

const JOB_TYPE_ICON = { INSTALLATION: Building2, REPAIR: Wrench, SERVICE: Settings };

type SafetyAnswer = { passed: boolean | null; remark: string };

export default function TechnicianWorkplansPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [me, setMe] = useState<{ id: string; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // ฟอร์มแผนงาน
  const [planJob, setPlanJob] = useState<Job | null>(null);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [techLoading, setTechLoading] = useState(false);
  const [selectedTechIds, setSelectedTechIds] = useState<string[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [materialQty, setMaterialQty] = useState(1);
  const [planMaterials, setPlanMaterials] = useState<{ materialId: string; materialName: string; quantity: number }[]>([]);

  // ฟอร์มทดสอบความปลอดภัย
  const [safetyJob, setSafetyJob] = useState<Job | null>(null);
  const [answers, setAnswers] = useState<Record<string, SafetyAnswer>>({});
  const [safetyNote, setSafetyNote] = useState("");

  const loadData = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch("/api/jobs").then((r) => r.json()),
      fetch("/api/materials").then((r) => r.json()),
      fetch("/api/materials/shortages").then((r) => r.json()),
    ])
      .then(([jobsRes, matRes, shortRes]) => {
        if (jobsRes.success) {
          setJobs(
            jobsRes.data.filter((j: Job) =>
              ["APPROVE", "PLAN_APPROVED", "IN_PROGRESS", "WAITING_ACCEPTANCE"].includes(j.status)
            )
          );
        }
        if (matRes.success) setMaterials(matRes.data);
        if (shortRes.success) setShortages(shortRes.data.shortages);
      })
      .finally(() => setLoading(false));
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.success && setMe({ id: d.data.sub, role: d.data.role }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // โหลดรายชื่อช่างพร้อมสถานะว่าง/ไม่ว่างตามช่วงวันที่เลือก
  useEffect(() => {
    if (!planJob || !startDate) return;
    const from = dateInputToIso(startDate);
    const to = dateInputToIso(endDate || startDate);
    setTechLoading(true);
    fetch(`/api/technicians?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&excludeJobId=${planJob.id}`)
      .then((r) => r.json())
      .then((d) => d.success && setTechnicians(d.data))
      .finally(() => setTechLoading(false));
  }, [planJob, startDate, endDate]);

  const shortageById = useMemo(() => new Map(shortages.map((s) => [s.id, s])), [shortages]);

  const openPlanForm = (job: Job) => {
    setMessage(null);
    setSafetyJob(null);
    setPlanJob(job);
    const plan = job.workPlan;
    setStartDate(toDateInput(plan?.startDate ?? new Date()));
    setEndDate(toDateInput(plan?.endDate ?? plan?.startDate ?? new Date()));
    setLocation(plan?.location || job.jobAddress);
    setSelectedTechIds(plan?.technicians.map((t) => t.employeeId) ?? []);
    setPlanMaterials(
      plan?.materials.map((m) => ({ materialId: m.materialId, materialName: m.material.materialName, quantity: m.quantity })) ?? []
    );
  };

  const openSafetyForm = (job: Job) => {
    setMessage(null);
    setPlanJob(null);
    setSafetyJob(job);
    // ทุกรอบเริ่มจากว่าง ให้ช่างทดสอบจริงครบทุกข้อ (ไม่ดึงผลรอบก่อนมาเป็นค่าเริ่มต้น)
    const init: Record<string, SafetyAnswer> = {};
    for (const item of SAFETY_CHECKLIST) init[item.key] = { passed: null, remark: "" };
    setAnswers(init);
    setSafetyNote("");
  };

  const toggleTech = (id: string) =>
    setSelectedTechIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const handleAddMaterialToPlan = () => {
    const mat = materials.find((m) => m.id === selectedMaterialId);
    if (!mat || planMaterials.some((m) => m.materialId === mat.id)) return;
    setPlanMaterials([...planMaterials, { materialId: mat.id, materialName: mat.materialName, quantity: materialQty }]);
    setSelectedMaterialId("");
    setMaterialQty(1);
  };

  const call = async (url: string, init: RequestInit, onOk: (d: { message?: string }) => void) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json();
      if (data.success) onOk(data);
      else setMessage({ type: "error", text: data.message ?? "ทำรายการไม่สำเร็จ" });
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePlan = () => {
    if (!planJob) return;
    if (selectedTechIds.length === 0) {
      setMessage({ type: "error", text: "กรุณาเลือกช่างผู้ปฏิบัติงานอย่างน้อย 1 คน" });
      return;
    }
    call(
      `/api/jobs/${planJob.id}/workplan`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: dateInputToIso(startDate),
          endDate: dateInputToIso(endDate || startDate),
          location: location || planJob.jobAddress,
          technicianIds: selectedTechIds,
          materials: planMaterials.map((m) => ({ materialId: m.materialId, quantity: m.quantity })),
        }),
      },
      (d) => {
        setMessage({ type: "success", text: d.message ?? "บันทึกแผนงานสำเร็จ ส่งให้ลูกค้าอนุมัติแล้ว" });
        setPlanJob(null);
        loadData();
      }
    );
  };

  const handleStartWork = (jobId: string) =>
    call(`/api/jobs/${jobId}/start`, { method: "PATCH" }, (d) => {
      setMessage({ type: "success", text: d.message ?? "เริ่มปฏิบัติงานสำเร็จ" });
      loadData();
    });

  const handleSafetyCheck = () => {
    if (!safetyJob) return;
    const missing = SAFETY_CHECKLIST.find((i) => answers[i.key]?.passed === null);
    if (missing) {
      setMessage({ type: "error", text: `กรุณาบันทึกผลข้อ "${missing.label}"` });
      return;
    }
    const noRemark = SAFETY_CHECKLIST.find((i) => answers[i.key]?.passed === false && !answers[i.key].remark.trim());
    if (noRemark) {
      setMessage({ type: "error", text: `กรุณาระบุสิ่งที่พบในข้อที่ไม่ผ่าน: "${noRemark.label}"` });
      return;
    }
    call(
      `/api/jobs/${safetyJob.id}/safety-check`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: SAFETY_CHECKLIST.map((i) => ({
            key: i.key,
            passed: answers[i.key].passed,
            remark: answers[i.key].remark || undefined,
          })),
          note: safetyNote || undefined,
        }),
      },
      (d) => {
        setMessage({ type: "success", text: d.message ?? "บันทึกผลทดสอบสำเร็จ" });
        setSafetyJob(null);
        loadData();
      }
    );
  };

  const isAssigned = (job: Job) => {
    const ids = job.workPlan?.technicians.map((t) => t.employeeId) ?? [];
    if (!me) return true;
    return me.role === "HEAD_TECHNICIAN" || ids.length === 0 || ids.includes(me.id);
  };

  const allPassed = SAFETY_CHECKLIST.every((i) => answers[i.key]?.passed === true);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">แผนงานและปฏิบัติงาน</h1>
        <p className="text-muted-foreground">จัดทำแผนงาน มอบหมายช่าง จองอุปกรณ์ เริ่มงาน และบันทึกผลทดสอบความปลอดภัย</p>
      </div>

      {message && (
        <div
          className={`p-4 rounded-md text-sm border ${
            message.type === "success"
              ? "bg-green-50 border-green-200 text-green-700"
              : "bg-destructive/10 border-destructive/30 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ฟอร์มทำ/แก้ไขแผนงาน */}
      {planJob && (
        <Card className="border-primary shadow-lg">
          <CardHeader>
            <CardTitle>{planJob.workPlan ? "แก้ไขแผนงานและส่งให้ลูกค้าอนุมัติใหม่" : "จัดทำแผนงาน"}</CardTitle>
            <CardDescription>
              {planJob.customer?.customerName} — {planJob.jobAddress}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {planJob.workPlan?.status === "REJECTED" && planJob.workPlan.rejectNote && (
              <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                ลูกค้าขอให้ปรับแผน: {planJob.workPlan.rejectNote}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">วันที่เริ่มต้น</Label>
                <Input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">วันที่สิ้นสุด</Label>
                <Input type="date" id="endDate" min={startDate} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">สถานที่ปฏิบัติงาน</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} />
              </div>
            </div>

            {/* มอบหมายช่าง */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" /> ช่างผู้ปฏิบัติงาน
                {techLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              </Label>
              <p className="text-xs text-muted-foreground">
                ระบบตรวจตารางงานของช่างแต่ละคนในช่วงวันที่เลือก ช่างที่มีงานชนกันจะเลือกไม่ได้
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {technicians.map((t) => {
                  const checked = selectedTechIds.includes(t.id);
                  const disabled = !t.available && !checked;
                  return (
                    <label
                      key={t.id}
                      className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${
                        disabled ? "opacity-60 bg-muted cursor-not-allowed" : "cursor-pointer hover:bg-accent"
                      } ${checked ? "border-primary bg-primary/5" : ""}`}
                    >
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 accent-primary"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleTech(t.id)}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{t.employeeName}</span>
                          <Badge variant="outline">{ROLE_LABEL[t.role] ?? t.role}</Badge>
                          {t.available ? (
                            <Badge variant="success">ว่าง</Badge>
                          ) : (
                            <Badge variant="destructive">ไม่ว่าง</Badge>
                          )}
                        </div>
                        {t.conflicts.map((c) => (
                          <p key={c.jobId} className="text-xs text-destructive mt-1">
                            มีงาน {thDateRange(c.startDate, c.endDate)} ที่ {c.jobAddress}
                          </p>
                        ))}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* จองอุปกรณ์ */}
            <div className="space-y-2">
              <Label>จองอุปกรณ์และอะไหล่จากคลัง</Label>
              <div className="flex gap-2">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                >
                  <option value="">-- เลือกอุปกรณ์ --</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.materialName} (คงเหลือ: {m.stockQuantity})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="1"
                  className="w-24"
                  value={materialQty}
                  onChange={(e) => setMaterialQty(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <Button type="button" onClick={handleAddMaterialToPlan} variant="secondary">
                  เพิ่ม
                </Button>
              </div>
              {planMaterials.length > 0 && (
                <ul className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  {planMaterials.map((m) => {
                    const stock = materials.find((x) => x.id === m.materialId)?.stockQuantity ?? 0;
                    return (
                      <li key={m.materialId} className="flex justify-between items-center bg-white px-3 py-1.5 rounded">
                        <span>
                          {m.materialName} (จำนวน: {m.quantity})
                          {m.quantity > stock && (
                            <span className="ml-2 text-xs text-amber-700">
                              คลังมี {stock} — ระบบจะแจ้งฝ่ายบัญชีให้สั่งซื้อเพิ่มอัตโนมัติ
                            </span>
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPlanMaterials(planMaterials.filter((x) => x.materialId !== m.materialId))}
                          className="text-destructive h-7 text-xs"
                        >
                          ลบ
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setPlanJob(null)}>
                ยกเลิก
              </Button>
              <Button onClick={handleSavePlan} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                บันทึกแผนงานและส่งอนุมัติ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ฟอร์ม Safety Checklist */}
      {safetyJob && (
        <Card className="border-green-500 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              ทดสอบและตรวจสอบความปลอดภัยตามรายการมาตรฐาน
            </CardTitle>
            <CardDescription>
              {safetyJob.customer?.customerName} — {safetyJob.jobAddress} · ต้องผ่านครบทุกข้อจึงจะส่งให้ลูกค้าตรวจรับได้
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y rounded-md border">
              {SAFETY_CHECKLIST.map((item, idx) => {
                const a = answers[item.key] ?? { passed: null, remark: "" };
                return (
                  <div key={item.key} className="p-3 space-y-2">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                      <span className="text-sm font-medium">
                        {idx + 1}. {item.label}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant={a.passed === true ? "default" : "outline"}
                          className={a.passed === true ? "bg-green-600 hover:bg-green-700" : ""}
                          onClick={() => setAnswers({ ...answers, [item.key]: { ...a, passed: true } })}
                        >
                          <CheckCircle2 className="h-4 w-4" /> ผ่าน
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant={a.passed === false ? "destructive" : "outline"}
                          onClick={() => setAnswers({ ...answers, [item.key]: { ...a, passed: false } })}
                        >
                          <XCircle className="h-4 w-4" /> ไม่ผ่าน
                        </Button>
                      </div>
                    </div>
                    {a.passed === false && (
                      <Input
                        placeholder="สิ่งที่พบ / ต้องแก้ไข (จำเป็น)"
                        value={a.remark}
                        onChange={(e) => setAnswers({ ...answers, [item.key]: { ...a, remark: e.target.value } })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="space-y-2">
              <Label htmlFor="safetyNote">หมายเหตุเพิ่มเติม</Label>
              <textarea
                id="safetyNote"
                className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={safetyNote}
                onChange={(e) => setSafetyNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setSafetyJob(null)}>
                ยกเลิก
              </Button>
              <Button
                onClick={handleSafetyCheck}
                disabled={actionLoading}
                className={allPassed ? "bg-green-600 hover:bg-green-700 text-white" : ""}
                variant={allPassed ? "default" : "destructive"}
              >
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                {allPassed ? "ยืนยันผ่านความปลอดภัย (ส่งให้ลูกค้าตรวจรับ)" : "บันทึกผล (ยังไม่ผ่าน — กลับไปแก้ไข)"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && jobs.length === 0 && (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            ไม่มีใบงานที่ต้องจัดทำแผนหรือปฏิบัติงานในขณะนี้
          </CardContent>
        </Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => {
            const Icon = JOB_TYPE_ICON[job.jobType];
            const plan = job.workPlan;
            const lastCheck = job.safetyChecks?.[0];
            // UC08 — เฉพาะหัวหน้าช่างจัดทำ/แก้ไขแผนงาน
            const canEditPlan =
              me?.role === "HEAD_TECHNICIAN" &&
              job.status === "APPROVE" &&
              (!plan || plan.status === "DRAFT" || plan.status === "REJECTED");
            const planShortages = plan?.materials.filter((m) => shortageById.has(m.materialId)) ?? [];
            const assigned = isAssigned(job);
            return (
              <Card key={job.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{JOB_TYPE_LABEL[job.jobType]}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {job.customer?.customerName} ({job.customer?.customerPhone})
                        </p>
                      </div>
                    </div>
                    <Badge variant={job.status === "IN_PROGRESS" ? "default" : "secondary"}>
                      {JOB_STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">สถานที่: {job.jobAddress}</p>

                  {job.status === "IN_PROGRESS" && job.reworkNote && (
                    <div className="flex gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                      <span>ลูกค้าตรวจรับไม่ผ่าน ต้องแก้ไข: {job.reworkNote}</span>
                    </div>
                  )}

                  {job.status === "IN_PROGRESS" && lastCheck && !lastCheck.passed && (
                    <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm">
                      <p className="font-medium text-destructive">
                        ทดสอบความปลอดภัยรอบล่าสุด ({thDate(lastCheck.checkedAt)}) ไม่ผ่าน:
                      </p>
                      <ul className="list-disc pl-5 text-destructive">
                        {lastCheck.items
                          .filter((i) => !i.passed)
                          .map((i) => (
                            <li key={i.key}>
                              {i.label}
                              {i.remark ? ` — ${i.remark}` : ""}
                            </li>
                          ))}
                      </ul>
                    </div>
                  )}

                  {plan && (
                    <div className="p-3 bg-muted rounded-md space-y-1.5 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span className="font-medium">{thDateRange(plan.startDate, plan.endDate)}</span>
                        <Badge variant={PLAN_STATUS_VARIANT[plan.status] ?? "outline"}>
                          {PLAN_STATUS_LABEL[plan.status] ?? plan.status}
                        </Badge>
                      </div>
                      {plan.status === "REJECTED" && plan.rejectNote && (
                        <p className="text-xs text-destructive">เหตุผลจากลูกค้า: {plan.rejectNote}</p>
                      )}
                      <p className="text-xs text-muted-foreground">สถานที่: {plan.location || job.jobAddress}</p>
                      <p className="text-xs">
                        ช่าง: {plan.technicians.length ? plan.technicians.map((t) => t.employee.employeeName).join(", ") : "ยังไม่ได้มอบหมาย"}
                      </p>
                      {plan.materials.length > 0 && (
                        <p className="text-xs">
                          อุปกรณ์ที่จอง: {plan.materials.map((m) => `${m.material.materialName} (${m.quantity})`).join(", ")}
                        </p>
                      )}
                      {planShortages.length > 0 && ["APPROVE", "PLAN_APPROVED"].includes(job.status) && (
                        <p className="flex items-center gap-1 text-xs text-amber-700">
                          <PackageX className="h-3.5 w-3.5" /> อะไหล่ในคลังยังไม่พอ:{" "}
                          {planShortages.map((m) => m.material.materialName).join(", ")} — แจ้งฝ่ายบัญชีแล้วอัตโนมัติ
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {canEditPlan && (
                      <Button size="sm" onClick={() => openPlanForm(job)} className="gap-1.5">
                        <Calendar className="h-4 w-4" />
                        {plan ? (plan.status === "REJECTED" ? "แก้ไขแผนตามที่ลูกค้าขอ" : "แก้ไขแผนงาน") : "ทำแผนงาน มอบหมายช่าง และจองอุปกรณ์"}
                      </Button>
                    )}
                    {job.status === "PLAN_APPROVED" && (
                      <Button
                        size="sm"
                        onClick={() => handleStartWork(job.id)}
                        disabled={actionLoading || !assigned}
                        title={assigned ? undefined : "งานนี้ไม่ได้มอบหมายให้คุณ"}
                        className="gap-1.5"
                      >
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                        เริ่มปฏิบัติงาน
                      </Button>
                    )}
                    {job.status === "IN_PROGRESS" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!assigned}
                        onClick={() => openSafetyForm(job)}
                        className="gap-1.5 border-green-500 text-green-700 hover:bg-green-50"
                      >
                        <ShieldCheck className="h-4 w-4" /> บันทึกผลทดสอบความปลอดภัย
                      </Button>
                    )}
                    {!assigned && ["PLAN_APPROVED", "IN_PROGRESS"].includes(job.status) && (
                      <span className="text-xs text-muted-foreground self-center">งานนี้ไม่ได้มอบหมายให้คุณ</span>
                    )}
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
