// src/app/accountant/quotations/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, Building2, Wrench, Settings, ChevronRight, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Job = {
  id: string;
  jobType: "INSTALLATION" | "REPAIR" | "SERVICE";
  jobAddress: string;
  status: string;
  requestDate: string;
  customer?: { customerName: string };
};

const JOB_TYPE_ICON = { INSTALLATION: Building2, REPAIR: Wrench, SERVICE: Settings };
const JOB_TYPE_LABEL = {
  INSTALLATION: "ติดตั้งลิฟต์",
  REPAIR: "ซ่อมรายครั้ง",
  SERVICE: "บำรุงรักษา",
};

export default function AccountantQuotationsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/jobs?status=PASS_SURVEY")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setJobs(d.data);
        else setError(d.message ?? "โหลดข้อมูลไม่สำเร็จ");
      })
      .catch(() => setError("โหลดข้อมูลไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">จัดทำใบเสนอราคา</h1>
        <p className="text-muted-foreground">
          รายการใบงานที่ผ่านการสำรวจแล้ว รอจัดทำใบเสนอราคา
        </p>
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
            <FileText className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg font-medium">ไม่มีใบงานที่รอจัดทำใบเสนอราคา</p>
            <p className="text-muted-foreground text-sm">
              ใบงานที่ผ่านการสำรวจแล้วจะแสดงที่นี่
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && jobs.length > 0 && (
        <div className="space-y-3">
          {jobs.map((job) => {
            const Icon = JOB_TYPE_ICON[job.jobType];
            return (
              <Card key={job.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-primary/10 rounded-full p-2">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">
                          {JOB_TYPE_LABEL[job.jobType]}
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {job.customer?.customerName}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">สำรวจแล้ว</Badge>
                      <Link href={`/accountant/quotations/${job.id}`}>
                        <Button size="sm" className="gap-1">
                          <FileText className="h-3.5 w-3.5" />
                          จัดทำใบเสนอราคา
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{job.jobAddress}</span>
                    <span>•</span>
                    <span>
                      ยื่นเมื่อ{" "}
                      {new Date(job.requestDate).toLocaleDateString("th-TH", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
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
