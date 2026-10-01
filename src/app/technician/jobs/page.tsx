// src/app/technician/jobs/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Building2, Wrench, Settings, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Job = {
  id: string;
  jobType: "INSTALLATION" | "REPAIR" | "SERVICE";
  jobAddress: string;
  status: string;
  requestDate: string;
  customer?: { customerName: string; customerPhone: string };
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "รอสำรวจ", PASS_SURVEY: "สำรวจแล้ว", APPROVE: "อนุมัติแล้ว",
  PLAN_APPROVED: "แผนงานอนุมัติ", IN_PROGRESS: "กำลังทำงาน",
  WAITING_ACCEPTANCE: "รอตรวจรับ", ACCEPTED: "ตรวจรับแล้ว",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "success" | "outline"> = {
  PENDING: "warning", PASS_SURVEY: "secondary", APPROVE: "success",
  PLAN_APPROVED: "success", IN_PROGRESS: "default", WAITING_ACCEPTANCE: "warning", ACCEPTED: "success",
};
const JOB_TYPE_ICON = { INSTALLATION: Building2, REPAIR: Wrench, SERVICE: Settings };
const JOB_TYPE_LABEL = { INSTALLATION: "ติดตั้งลิฟต์", REPAIR: "ซ่อมรายครั้ง", SERVICE: "บำรุงรักษา" };

export default function TechnicianJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/jobs")
      .then((r) => r.json())
      .then((d) => { if (d.success) setJobs(d.data); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">รายการใบงาน</h1>
        <p className="text-muted-foreground">ใบงานทั้งหมดที่ต้องดำเนินการ</p>
      </div>

      {loading && <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}

      {!loading && jobs.length === 0 && (
        <Card><CardContent className="py-20 text-center text-muted-foreground">ไม่มีใบงานในขณะนี้</CardContent></Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const Icon = JOB_TYPE_ICON[job.jobType];
            return (
              <Link key={job.id} href={`/technician/jobs/${job.id}/survey`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-primary/10 rounded-full p-2">
                          <Icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-base">{JOB_TYPE_LABEL[job.jobType]}</CardTitle>
                          <p className="text-sm text-muted-foreground">{job.customer?.customerName}</p>
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
                    <p className="text-xs text-muted-foreground">{job.jobAddress}</p>
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
