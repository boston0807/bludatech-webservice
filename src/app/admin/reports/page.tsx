// src/app/admin/reports/page.tsx
// รายงานตาม Output design บทที่ 6 (3 รายงาน) — เลือกช่วงวันที่ได้ และพิมพ์/บันทึกเป็น PDF ได้
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Printer, BarChart3, History, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JOB_TYPE_LABEL, baht, thDate, toDateInput } from "@/lib/labels";

type SummaryRow = {
  jobType: string;
  totalJobs: number;
  completedJobs: number;
  inProgressJobs: number;
  cancelledJobs: number;
  totalRevenue: number;
  avgRevenue: number;
};
type HistoryRow = {
  historyId: string;
  completedDate: string;
  customerName: string;
  jobType: string;
  technicianNames: string;
  totalCost: number;
  endServiceDate: string | null;
};
type MaterialRow = {
  id: string;
  materialName: string;
  price: number;
  usedQty: number;
  reservedQty: number;
  stockQuantity: number;
  stockValue: number;
  shortageQty: number;
};

const num = (n: number) => n.toLocaleString("th-TH");

export default function AdminReportsPage() {
  const now = new Date();
  const [from, setFrom] = useState(`${now.getFullYear()}-01-01`);
  const [to, setTo] = useState(toDateInput(now));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ rows: SummaryRow[]; totals: Omit<SummaryRow, "jobType"> } | null>(null);
  const [history, setHistory] = useState<{ rows: HistoryRow[]; totals: { count: number; totalCost: number } } | null>(null);
  const [materials, setMaterials] = useState<{
    rows: MaterialRow[];
    totals: { usedQty: number; reservedQty: number; stockValue: number; shortageItems: number };
  } | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const q = `from=${from}&to=${to}`;
    Promise.all([
      fetch(`/api/reports?type=jobs-summary&${q}`).then((r) => r.json()),
      fetch(`/api/reports?type=service-history&${q}`).then((r) => r.json()),
      fetch(`/api/reports?type=materials`).then((r) => r.json()),
    ])
      .then(([s, h, m]) => {
        if (!s.success || !h.success || !m.success) {
          setError(s.message || h.message || m.message || "โหลดรายงานไม่สำเร็จ");
          return;
        }
        setSummary(s.data);
        setHistory(h.data);
        setMaterials(m.data);
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการโหลดรายงาน"))
      .finally(() => setLoading(false));
  }, [from, to]);

  useEffect(() => {
    load();
    // โหลดครั้งแรกเท่านั้น ครั้งต่อไปกดปุ่ม "แสดงรายงาน"
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const th = "px-3 py-2 text-left font-medium text-muted-foreground border-b";
  const thR = "px-3 py-2 text-right font-medium text-muted-foreground border-b";
  const td = "px-3 py-2 border-b";
  const tdR = "px-3 py-2 border-b text-right tabular-nums";

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">รายงาน</h1>
          <p className="text-muted-foreground">
            ช่วงวันที่ {thDate(`${from}T00:00:00+07:00`)} – {thDate(`${to}T00:00:00+07:00`)}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2 print:hidden">
          <div className="space-y-1">
            <Label htmlFor="from">ตั้งแต่</Label>
            <Input id="from" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="to">ถึง</Label>
            <Input id="to" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={load} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />} แสดงรายงาน
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> พิมพ์ / PDF
          </Button>
        </div>
      </div>

      {error && <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{error}</div>}

      {loading && !summary ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {summary && (
            <Card className="print:shadow-none print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" /> 1. สรุปภาพรวมงานบริการแยกตามประเภทงาน
                </CardTitle>
                <CardDescription>นับจากวันที่ลูกค้ายื่นคำขอในช่วงที่เลือก รายได้นับจากงานที่บันทึกประวัติแล้ว</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={th}>ประเภทงาน</th>
                      <th className={thR}>งานทั้งหมด</th>
                      <th className={thR}>เสร็จสิ้น</th>
                      <th className={thR}>กำลังดำเนินการ</th>
                      <th className={thR}>ยกเลิก</th>
                      <th className={thR}>รายได้รวม (บาท)</th>
                      <th className={thR}>รายได้เฉลี่ย/งาน (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.rows.map((r) => (
                      <tr key={r.jobType}>
                        <td className={td}>{JOB_TYPE_LABEL[r.jobType]}</td>
                        <td className={tdR}>{num(r.totalJobs)}</td>
                        <td className={tdR}>{num(r.completedJobs)}</td>
                        <td className={tdR}>{num(r.inProgressJobs)}</td>
                        <td className={tdR}>{num(r.cancelledJobs)}</td>
                        <td className={tdR}>{baht(r.totalRevenue).replace(" บาท", "")}</td>
                        <td className={tdR}>{baht(r.avgRevenue).replace(" บาท", "")}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="font-semibold">
                    <tr>
                      <td className={td}>รวม</td>
                      <td className={tdR}>{num(summary.totals.totalJobs)}</td>
                      <td className={tdR}>{num(summary.totals.completedJobs)}</td>
                      <td className={tdR}>{num(summary.totals.inProgressJobs)}</td>
                      <td className={tdR}>{num(summary.totals.cancelledJobs)}</td>
                      <td className={tdR}>{baht(summary.totals.totalRevenue).replace(" บาท", "")}</td>
                      <td className={tdR}>{baht(summary.totals.avgRevenue).replace(" บาท", "")}</td>
                    </tr>
                  </tfoot>
                </table>
              </CardContent>
            </Card>
          )}

          {history && (
            <Card className="print:shadow-none">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-5 w-5 text-primary" /> 2. ประวัติการให้บริการลูกค้า
                </CardTitle>
                <CardDescription>
                  งานที่บันทึกประวัติในช่วงที่เลือก {num(history.totals.count)} งาน รวม {baht(history.totals.totalCost)}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                {history.rows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">ไม่มีงานที่บันทึกประวัติในช่วงนี้</p>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        <th className={th}>วันที่เสร็จสิ้น</th>
                        <th className={th}>ลูกค้า</th>
                        <th className={th}>ประเภทงาน</th>
                        <th className={th}>ช่างผู้ปฏิบัติงาน</th>
                        <th className={thR}>ค่าใช้จ่ายรวม (บาท)</th>
                        <th className={th}>สิ้นสุดอายุบริการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.rows.map((r) => (
                        <tr key={r.historyId}>
                          <td className={td}>{thDate(r.completedDate)}</td>
                          <td className={td}>{r.customerName}</td>
                          <td className={td}>{JOB_TYPE_LABEL[r.jobType]}</td>
                          <td className={td}>{r.technicianNames}</td>
                          <td className={tdR}>{baht(r.totalCost).replace(" บาท", "")}</td>
                          <td className={td}>{r.endServiceDate ? thDate(r.endServiceDate) : "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {materials && (
            <Card className="print:shadow-none print:break-inside-avoid">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" /> 3. การใช้วัสดุและสต็อกคงเหลือ (ณ ปัจจุบัน)
                </CardTitle>
                <CardDescription>
                  ใช้ไปแล้ว = แผนงานของงานที่เริ่มแล้ว · จองไว้ = แผนงานที่ยังไม่เริ่ม · มูลค่าคงเหลือรวม{" "}
                  {baht(materials.totals.stockValue)}
                  {materials.totals.shortageItems > 0 && ` · ต้องสั่งซื้อเพิ่ม ${materials.totals.shortageItems} รายการ`}
                </CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className={th}>วัสดุ</th>
                      <th className={thR}>ราคา/หน่วย</th>
                      <th className={thR}>ใช้ไปแล้ว</th>
                      <th className={thR}>จองไว้</th>
                      <th className={thR}>คงเหลือ</th>
                      <th className={thR}>มูลค่าคงเหลือ (บาท)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.rows.map((r) => (
                      <tr key={r.id} className={r.shortageQty > 0 ? "bg-amber-50" : ""}>
                        <td className={td}>
                          {r.materialName}
                          {r.shortageQty > 0 && <span className="ml-2 text-xs text-amber-700">ขาด {r.shortageQty}</span>}
                        </td>
                        <td className={tdR}>{baht(r.price).replace(" บาท", "")}</td>
                        <td className={tdR}>{num(r.usedQty)}</td>
                        <td className={tdR}>{num(r.reservedQty)}</td>
                        <td className={tdR}>{num(r.stockQuantity)}</td>
                        <td className={tdR}>{baht(r.stockValue).replace(" บาท", "")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
