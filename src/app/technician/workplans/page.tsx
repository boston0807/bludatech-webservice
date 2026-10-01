// src/app/technician/workplans/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, ClipboardCheck, Building2, Wrench, Settings, Calendar, ShieldCheck, Play, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Material = {
  id: string;
  materialName: string;
  stockQuantity: number;
};

type Job = {
  id: string;
  jobType: "INSTALLATION" | "REPAIR" | "SERVICE";
  jobAddress: string;
  status: string;
  requestDate: string;
  customer?: { customerName: string; customerPhone: string };
  workPlan?: {
    id: string;
    startDate: string;
    endDate: string;
    location?: string;
    status: string;
    materials?: { materialId: string; quantity: number; material: { materialName: string; stockQuantity: number } }[];
  };
};

const JOB_TYPE_ICON = { INSTALLATION: Building2, REPAIR: Wrench, SERVICE: Settings };
const JOB_TYPE_LABEL = { INSTALLATION: "ติดตั้งลิฟต์", REPAIR: "ซ่อมรายครั้ง", SERVICE: "บำรุงรักษา" };

const STATUS_LABEL: Record<string, string> = {
  PASS_SURVEY: "สำรวจแล้ว",
  APPROVE: "อนุมัติใบเสนอราคาแล้ว",
  PLAN_APPROVED: "แผนงานอนุมัติแล้ว",
  IN_PROGRESS: "กำลังปฏิบัติงาน",
  WAITING_ACCEPTANCE: "รอตรวจรับงาน",
  ACCEPTED: "ตรวจรับแล้ว",
};

export default function TechnicianWorkplansPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  // Form states for creating/updating workplan
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [location, setLocation] = useState("");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [materialQty, setMaterialQty] = useState(1);
  const [planMaterials, setPlanMaterials] = useState<{ materialId: string; materialName: string; quantity: number }[]>([]);

  // Safety check notes
  const [safetyNote, setSafetyNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      fetch("/api/jobs").then((r) => r.json()),
      fetch("/api/materials").then((r) => r.json()),
    ])
      .then(([jobsRes, matRes]) => {
        if (jobsRes.success) {
          // Filter jobs that are approved or in progress/planning phase
          const filtered = jobsRes.data.filter((j: Job) =>
            ["APPROVE", "PLAN_APPROVED", "IN_PROGRESS", "WAITING_ACCEPTANCE"].includes(j.status)
          );
          setJobs(filtered);
        }
        if (matRes.success) setMaterials(matRes.data);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddMaterialToPlan = () => {
    if (!selectedMaterialId) return;
    const mat = materials.find((m) => m.id === selectedMaterialId);
    if (!mat) return;
    if (planMaterials.some((m) => m.materialId === selectedMaterialId)) return;

    setPlanMaterials([...planMaterials, { materialId: mat.id, materialName: mat.materialName, quantity: materialQty }]);
    setSelectedMaterialId("");
    setMaterialQty(1);
  };

  const handleRemoveMaterial = (materialId: string) => {
    setPlanMaterials(planMaterials.filter((m) => m.materialId !== materialId));
  };

  const handleCreateWorkPlan = async (jobId: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/workplan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
          endDate: endDate ? new Date(endDate).toISOString() : (startDate ? new Date(startDate).toISOString() : new Date().toISOString()),
          location: location || selectedJob?.jobAddress,
          materials: planMaterials.map((m) => ({ materialId: m.materialId, quantity: m.quantity })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "บันทึกแผนงานและจองอุปกรณ์สำเร็จ" });
        setSelectedJob(null);
        setPlanMaterials([]);
        loadData();
      } else {
        setMessage({ type: "error", text: data.message ?? "บันทึกแผนงานไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาดในการบันทึกแผนงาน" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWork = async (jobId: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/start`, { method: "PATCH" });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "เริ่มปฏิบัติงานสำเร็จ (ตัดสต็อกอุปกรณ์เรียบร้อย)" });
        loadData();
      } else {
        setMessage({ type: "error", text: data.message ?? "เริ่มงานไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด" });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSafetyCheck = async (jobId: string) => {
    setActionLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/jobs/${jobId}/safety-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passed: true,
          safetyNote: safetyNote || "ผ่านการตรวจสอบความปลอดภัยตามมาตรฐาน",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "บันทึกผลทดสอบความปลอดภัยสำเร็จ (รอตรวจรับจากลูกค้า)" });
        setSelectedJob(null);
        setSafetyNote("");
        loadData();
      } else {
        setMessage({ type: "error", text: data.message ?? "บันทึกไม่สำเร็จ" });
      }
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด" });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">แผนงานและปฏิบัติงาน</h1>
        <p className="text-muted-foreground">จัดการแผนงาน จัดสรรช่าง จองอุปกรณ์ และบันทึกผลปฏิบัติงาน</p>
      </div>

      {message && (
        <div className={`p-4 rounded-md text-sm border ${message.type === "success" ? "bg-green-50 border-green-200 text-green-700" : "bg-destructive/10 border-destructive/30 text-destructive"}`}>
          {message.text}
        </div>
      )}

      {loading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {!loading && jobs.length === 0 && (
        <Card><CardContent className="py-20 text-center text-muted-foreground">ไม่มีใบงานที่ต้องจัดทำแผนหรือปฏิบัติงานในขณะนี้</CardContent></Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-4">
          {jobs.map((job) => {
            const Icon = JOB_TYPE_ICON[job.jobType];
            return (
              <Card key={job.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{JOB_TYPE_LABEL[job.jobType]}</CardTitle>
                        <p className="text-sm text-muted-foreground">{job.customer?.customerName} ({job.customer?.customerPhone})</p>
                      </div>
                    </div>
                    <Badge variant={job.status === "PLAN_APPROVED" ? "success" : job.status === "IN_PROGRESS" ? "default" : "secondary"}>
                      {STATUS_LABEL[job.status] ?? job.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-xs text-muted-foreground">
                    <p>สถานที่: {job.jobAddress}</p>
                    {job.workPlan && (
                      <div className="mt-2 p-3 bg-muted rounded-md space-y-1 text-foreground">
                        <p className="font-medium">แผนงาน: วันที่เริ่มต้น {new Date(job.workPlan.startDate).toLocaleDateString("th-TH")} {job.workPlan.endDate ? `ถึง ${new Date(job.workPlan.endDate).toLocaleDateString("th-TH")}` : ""}</p>
                        <p className="text-xs text-muted-foreground">สถานที่: {job.workPlan.location || job.jobAddress} | สถานะแผน: {job.workPlan.status}</p>
                        {job.workPlan.materials && job.workPlan.materials.length > 0 && (
                          <p className="text-xs">อุปกรณ์ที่จอง: {job.workPlan.materials.map(m => `${m.material.materialName} (${m.quantity})`).join(", ")}</p>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions based on Job Status */}
                  <div className="flex flex-wrap gap-2 pt-2 border-t">
                    {job.status === "APPROVE" && (
                      <Button size="sm" onClick={() => { setSelectedJob(job); setStartDate(new Date().toISOString().split("T")[0]); setEndDate(new Date().toISOString().split("T")[0]); setLocation(job.jobAddress); }} className="gap-1.5">
                        <Calendar className="h-4 w-4" /> ทำแผนงานและจองอุปกรณ์
                      </Button>
                    )}

                    {job.status === "PLAN_APPROVED" && (
                      <Button size="sm" onClick={() => handleStartWork(job.id)} disabled={actionLoading} className="gap-1.5">
                        {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} เริ่มปฏิบัติงาน (IN_PROGRESS)
                      </Button>
                    )}

                    {job.status === "IN_PROGRESS" && (
                      <Button size="sm" variant="outline" onClick={() => setSelectedJob(job)} className="gap-1.5 border-green-500 text-green-700 hover:bg-green-50">
                        <ShieldCheck className="h-4 w-4" /> บันทึกทดสอบความปลอดภัย
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Modal / Section for Creating WorkPlan */}
      {selectedJob && selectedJob.status === "APPROVE" && (
        <Card className="border-primary shadow-lg">
          <CardHeader>
            <CardTitle>จัดทำแผนงานสำหรับใบงาน</CardTitle>
            <CardDescription>{selectedJob.customer?.customerName} — {selectedJob.jobAddress}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate">วันที่เริ่มต้นปฏิบัติงาน</Label>
                <Input type="date" id="startDate" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate">วันที่สิ้นสุดปฏิบัติงาน</Label>
                <Input type="date" id="endDate" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">สถานที่ปฏิบัติงาน</Label>
                <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder={selectedJob.jobAddress} />
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label>จองอุปกรณ์และอะไหล่จากคลัง</Label>
              <div className="flex gap-2">
                <select
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selectedMaterialId}
                  onChange={(e) => setSelectedMaterialId(e.target.value)}
                >
                  <option value="">-- เลือกอุปกรณ์ --</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>{m.materialName} (คงเหลือ: {m.stockQuantity})</option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="1"
                  className="w-24"
                  value={materialQty}
                  onChange={(e) => setMaterialQty(parseInt(e.target.value) || 1)}
                />
                <Button type="button" onClick={handleAddMaterialToPlan} variant="secondary">เพิ่ม</Button>
              </div>

              {planMaterials.length > 0 && (
                <div className="bg-muted p-3 rounded-md space-y-2 mt-2">
                  <p className="text-xs font-semibold">รายการอุปกรณ์ที่เลือกจอง:</p>
                  <ul className="space-y-1 text-sm">
                    {planMaterials.map((m) => (
                      <li key={m.materialId} className="flex justify-between items-center bg-white px-3 py-1.5 rounded shadow-xs">
                        <span>{m.materialName} (จำนวน: {m.quantity})</span>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveMaterial(m.materialId)} className="text-destructive h-7 text-xs">ลบ</Button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setSelectedJob(null)}>ยกเลิก</Button>
              <Button onClick={() => handleCreateWorkPlan(selectedJob.id)} disabled={actionLoading}>
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                บันทึกแผนงานและส่งอนุมัติ
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal / Section for Safety Check */}
      {selectedJob && selectedJob.status === "IN_PROGRESS" && (
        <Card className="border-green-500 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-green-600" />
              ทดสอบและตรวจสอบความปลอดภัย (Safety Check)
            </CardTitle>
            <CardDescription>{selectedJob.customer?.customerName} — {selectedJob.jobAddress}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="safetyNote">บันทึกผลการตรวจสอบความปลอดภัย</Label>
              <textarea
                id="safetyNote"
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="ผลการทดสอบเบรก, ระบบฉุกเฉิน, เซนเซอร์ประตู ฯลฯ ผ่านเกณฑ์มาตรฐาน"
                value={safetyNote}
                onChange={(e) => setSafetyNote(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSelectedJob(null)}>ยกเลิก</Button>
              <Button onClick={() => handleSafetyCheck(selectedJob.id)} disabled={actionLoading} className="bg-green-600 hover:bg-green-700 text-white">
                {actionLoading && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                ยืนยันผ่านความปลอดภัย (ส่งให้ลูกค้าตรวจรับ)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
