// src/app/(customer)/jobs/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FilePlus, Loader2, Building2, Wrench, Settings, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Job = {
  id: string;
  jobType: "INSTALLATION" | "REPAIR" | "SERVICE";
  jobAddress: string;
  status: string;
  requestDate: string;
};

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

const STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "success" | "destructive" | "outline"> = {
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

const JOB_TYPE_ICON = {
  INSTALLATION: Building2,
  REPAIR: Wrench,
  SERVICE: Settings,
};

const JOB_TYPE_LABEL = {
  INSTALLATION: "ติดตั้งลิฟต์",
  REPAIR: "ซ่อมรายครั้ง",
  SERVICE: "บำรุงรักษา",
};

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setJobs(data.data);
        else setError(data.message);
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ใบงานของฉัน</h1>
          <p className="text-muted-foreground">ติดตามสถานะคำขอรับบริการทั้งหมด</p>
        </div>
        <Link href="/jobs/new">
          <Button>
            <FilePlus className="h-4 w-4" />
            ยื่นคำขอใหม่
          </Button>
        </Link>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && jobs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center gap-3">
            <FilePlus className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">ยังไม่มีใบงาน</p>
            <p className="text-muted-foreground text-sm">เริ่มต้นด้วยการยื่นคำขอบริการ</p>
            <Link href="/jobs/new">
              <Button variant="outline">ยื่นคำขอบริการ</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const Icon = JOB_TYPE_ICON[job.jobType];
            return (
              <Link key={job.id} href={`/jobs/${job.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-full p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{JOB_TYPE_LABEL[job.jobType]}</CardTitle>
                          <p className="text-sm text-muted-foreground truncate max-w-xs">{job.jobAddress}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={STATUS_VARIANT[job.status] ?? "outline"}>
                          {STATUS_LABEL[job.status] ?? job.status}
                        </Badge>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      วันที่ยื่น:{" "}
                      {new Date(job.requestDate).toLocaleDateString("th-TH", {
                        year: "numeric", month: "long", day: "numeric",
                      })}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
