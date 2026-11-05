// src/app/technician/schedule/page.tsx
// ตารางงานช่าง — ช่างเห็นงานที่ได้รับมอบหมาย, หัวหน้าช่างเห็นของทั้งทีม (แก้ปัญหาช่างลืมนัด/งานซ้อน)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CalendarDays, MapPin, Users, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { JOB_TYPE_LABEL, JOB_STATUS_LABEL, PLAN_STATUS_LABEL, thDate, thDateRange } from "@/lib/labels";

type Item = {
  planId: string;
  planStatus: string;
  startDate: string;
  endDate: string;
  location: string;
  isToday: boolean;
  isOverdue: boolean;
  job: {
    id: string;
    jobType: string;
    jobAddress: string;
    status: string;
    reworkNote: string | null;
    customer: { customerName: string; customerPhone: string };
  };
  technicians: { id: string; employeeName: string }[];
  materials: { materialName: string; quantity: number }[];
};

export default function TechnicianSchedulePage() {
  const [items, setItems] = useState<Item[]>([]);
  const [onlyMine, setOnlyMine] = useState(true);
  const [canSeeTeam, setCanSeeTeam] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && setCanSeeTeam(d.data.role === "HEAD_TECHNICIAN"))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/technicians/schedule${onlyMine ? "?mine=1" : ""}`)
      .then((r) => r.json())
      .then((d) => d.success && setItems(d.data.items))
      .finally(() => setLoading(false));
  }, [onlyMine]);

  // จัดกลุ่มตามวันเริ่มงาน
  const groups = items.reduce<Record<string, Item[]>>((acc, it) => {
    const key = it.isOverdue ? "เลยกำหนด" : it.isToday ? "วันนี้" : thDate(it.startDate);
    (acc[key] ??= []).push(it);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ตารางงาน</h1>
          <p className="text-muted-foreground">งานที่ได้รับมอบหมายตามแผนงาน เรียงตามวันที่เข้าปฏิบัติงาน</p>
        </div>
        {canSeeTeam && (
          <div className="flex gap-2">
            <Button size="sm" variant={onlyMine ? "default" : "outline"} onClick={() => setOnlyMine(true)}>
              งานของฉัน
            </Button>
            <Button size="sm" variant={!onlyMine ? "default" : "outline"} onClick={() => setOnlyMine(false)}>
              ทั้งทีม
            </Button>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">ยังไม่มีงานที่ได้รับมอบหมาย</CardContent>
        </Card>
      ) : (
        Object.entries(groups).map(([day, list]) => (
          <div key={day} className="space-y-3">
            <h2 className={`text-sm font-semibold flex items-center gap-2 ${day === "เลยกำหนด" ? "text-destructive" : ""}`}>
              <CalendarDays className="h-4 w-4" /> {day}
            </h2>
            {list.map((it) => (
              <Card key={it.planId} className={it.isToday ? "border-primary" : it.isOverdue ? "border-destructive" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {JOB_TYPE_LABEL[it.job.jobType]} — {it.job.customer.customerName}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {it.location}
                      </CardDescription>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary">{JOB_STATUS_LABEL[it.job.status] ?? it.job.status}</Badge>
                      <span className="text-xs text-muted-foreground">{PLAN_STATUS_LABEL[it.planStatus] ?? it.planStatus}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p>
                    <span className="text-muted-foreground">วันที่: </span>
                    {thDateRange(it.startDate, it.endDate)} · โทร {it.job.customer.customerPhone}
                  </p>
                  <p className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> {it.technicians.map((t) => t.employeeName).join(", ")}
                  </p>
                  {it.materials.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      อุปกรณ์ที่ต้องนำไป: {it.materials.map((m) => `${m.materialName} (${m.quantity})`).join(", ")}
                    </p>
                  )}
                  {it.job.reworkNote && it.job.status === "IN_PROGRESS" && (
                    <p className="flex items-center gap-1 text-xs text-amber-700">
                      <AlertTriangle className="h-3.5 w-3.5" /> ลูกค้าขอให้แก้ไข: {it.job.reworkNote}
                    </p>
                  )}
                  <div className="pt-2">
                    <Link href="/technician/workplans" className="text-xs text-primary hover:underline">
                      ไปหน้าแผนงานเพื่อเริ่มงาน / บันทึกผล →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
