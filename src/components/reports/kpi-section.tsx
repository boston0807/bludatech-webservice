// src/components/reports/kpi-section.tsx — รายงานที่ 4 ตัวชี้วัดการดำเนินงาน (KPI)
"use client";

import type { ReactNode } from "react";
import { Gauge } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JOB_TYPE_LABEL, baht } from "@/lib/labels";

export type Kpi = {
  jobCount: number;
  stages: { key: string; label: string; avgDays: number | null; sample: number }[];
  revenueByType: { jobType: string; payments: number; amount: number }[];
  revenueTotal: number;
};

const num = (n: number) => n.toLocaleString("th-TH");
const money = (n: number) => baht(n).replace(" บาท", "");

const th = "px-3 py-2 text-left font-medium text-muted-foreground border-b";
const thR = "px-3 py-2 text-right font-medium text-muted-foreground border-b";
const td = "px-3 py-2 border-b";
const tdR = "px-3 py-2 border-b text-right tabular-nums";

export function KpiSection({ kpi, action }: { kpi: Kpi; action?: ReactNode }) {
  const overall = kpi.stages.find((st) => st.key === "request_to_payment");
  const maxDays = Math.max(1, ...kpi.stages.filter((s) => s.key !== "request_to_payment").map((s) => s.avgDays ?? 0));

  return (
    <Card className="print:shadow-none print:break-before-page">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Gauge className="h-5 w-5 text-primary" /> 4. ตัวชี้วัดการดำเนินงาน (KPI)
          </CardTitle>
          {action}
        </div>
        <CardDescription>
          จากใบงานที่ยื่นในช่วงที่เลือก {num(kpi.jobCount)} งาน · เวลาอนุมัติใบเสนอราคา/แผนงานเป็นค่าประมาณจากเวลาแก้ไขล่าสุดของเอกสาร
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">ระยะเวลาเฉลี่ยทั้งกระบวนการ</p>
            <p className="text-2xl font-bold">{overall?.avgDays == null ? "-" : `${overall.avgDays} วัน`}</p>
            <p className="text-xs text-muted-foreground">ตั้งแต่ยื่นคำขอจนชำระเงิน ({num(overall?.sample ?? 0)} งาน)</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">รายได้ที่รับชำระในช่วงนี้</p>
            <p className="text-2xl font-bold">{baht(kpi.revenueTotal)}</p>
            <p className="text-xs text-muted-foreground">นับตามวันที่ลูกค้าชำระเงิน</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">ระยะเวลาเฉลี่ยของแต่ละขั้นตอน</p>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className={th}>ขั้นตอน</th>
                <th className={`${th} w-1/3 print:hidden`}></th>
                <th className={thR}>เฉลี่ย (วัน)</th>
                <th className={thR}>งานที่นำมาคำนวณ</th>
              </tr>
            </thead>
            <tbody>
              {kpi.stages
                .filter((st) => st.key !== "request_to_payment")
                .map((st) => (
                  <tr key={st.key}>
                    <td className={td}>{st.label}</td>
                    <td className={`${td} print:hidden`}>
                      <div className="h-2 rounded bg-muted">
                        <div
                          className="h-2 rounded bg-primary"
                          style={{ width: `${st.avgDays ? Math.max(2, (st.avgDays / maxDays) * 100) : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className={tdR}>{st.avgDays === null ? "-" : st.avgDays.toLocaleString("th-TH")}</td>
                    <td className={tdR}>{num(st.sample)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div>
            <p className="text-sm font-medium mb-2">รายได้รับชำระแยกตามประเภทงาน</p>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>ประเภทงาน</th>
                  <th className={thR}>รายการ</th>
                  <th className={thR}>ยอด (บาท)</th>
                  <th className={thR}>สัดส่วน</th>
                </tr>
              </thead>
              <tbody>
                {kpi.revenueByType.map((r) => (
                  <tr key={r.jobType}>
                    <td className={td}>{JOB_TYPE_LABEL[r.jobType]}</td>
                    <td className={tdR}>{num(r.payments)}</td>
                    <td className={tdR}>{money(r.amount)}</td>
                    <td className={tdR}>{kpi.revenueTotal > 0 ? `${Math.round((r.amount / kpi.revenueTotal) * 100)}%` : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
        </div>
      </CardContent>
    </Card>
  );
}
