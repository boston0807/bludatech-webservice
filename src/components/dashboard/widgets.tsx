// src/components/dashboard/widgets.tsx
// การ์ดแจ้งเตือนบน Dashboard ของแต่ละบทบาท (ดึงข้อมูลจริงจาก API)
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CalendarClock, CalendarDays, PackageX, Receipt, AlertTriangle, PackageSearch, Wallet } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JOB_TYPE_LABEL, thDate, thDateRange } from "@/lib/labels";

function useApi<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((d) => d.success && setData(d.data))
      .catch(() => {})
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, tick, ...deps]);
  return { data, loading, reload: () => setTick((t) => t + 1) };
}

type ServiceRound = {
  contractJobId: string;
  customer: { customerName: string; customerPhone: string };
  jobAddress: string;
  nextServiceDate: string | null;
  endServiceDate: string | null;
  dueInDays: number | null;
  dueStatus: "OVERDUE" | "DUE_SOON" | "SCHEDULED" | "ENDED";
  nextRoundNumber: number;
  openRound: { id: string; status: string } | null;
  canCreateRound: boolean;
};

function dueLabel(r: ServiceRound) {
  if (r.dueStatus === "ENDED") return "สัญญาสิ้นสุดแล้ว";
  if (r.dueInDays === null) return "-";
  if (r.dueInDays < 0) return `เลยกำหนด ${-r.dueInDays} วัน`;
  if (r.dueInDays === 0) return "ครบกำหนดวันนี้";
  return `อีก ${r.dueInDays} วัน`;
}

/** ธุรการ: รอบบำรุงที่ใกล้ถึง/เลยกำหนด พร้อมปุ่มสร้างใบงานรอบนี้ */
export function ServiceRoundsPanel({ showAll = false }: { showAll?: boolean }) {
  const { data, loading, reload } = useApi<ServiceRound[]>("/api/service-rounds");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const create = async (id: string) => {
    setBusy(id);
    setMsg(null);
    try {
      const res = await fetch(`/api/service-rounds/${id}`, { method: "POST" });
      const d = await res.json();
      setMsg({ ok: d.success, text: d.message ?? (d.success ? "สร้างใบงานแล้ว" : "สร้างใบงานไม่สำเร็จ") });
      reload();
    } finally {
      setBusy(null);
    }
  };

  const rows = (data ?? []).filter((r) => showAll || r.dueStatus === "OVERDUE" || r.dueStatus === "DUE_SOON");

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          {showAll ? "สัญญาบำรุงรักษาทั้งหมด" : "รอบบำรุงรักษาที่ใกล้ถึงกำหนด"}
        </CardTitle>
        <CardDescription>
          ระบบตั้งรอบบำรุงถัดไปให้อัตโนมัติทุก 1 เดือนหลังปิดงานบำรุง (สัญญา 2 ปี) สร้างใบงานรอบใหม่ได้ล่วงหน้า 14 วัน
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {msg && (
          <div className={`rounded-md px-3 py-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-destructive/10 text-destructive"}`}>
            {msg.text}
          </div>
        )}
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">{showAll ? "ยังไม่มีสัญญาบำรุงรักษา" : "ไม่มีรอบบำรุงที่ใกล้ถึงกำหนด"}</p>
        ) : (
          rows.map((r) => (
            <div key={r.contractJobId} className="flex flex-col md:flex-row md:items-center justify-between gap-2 rounded-md border px-3 py-2">
              <div className="text-sm">
                <p className="font-medium">
                  {r.customer.customerName}{" "}
                  <Badge variant={r.dueStatus === "OVERDUE" ? "destructive" : r.dueStatus === "DUE_SOON" ? "warning" : "secondary"}>
                    {dueLabel(r)}
                  </Badge>
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.jobAddress} · รอบถัดไป {thDate(r.nextServiceDate)} · สัญญาถึง {thDate(r.endServiceDate)}
                </p>
                {r.openRound && <p className="text-xs text-amber-700">มีใบงานรอบก่อนที่ยังไม่ปิด</p>}
              </div>
              {r.canCreateRound && (
                <Button size="sm" onClick={() => create(r.contractJobId)} disabled={busy === r.contractJobId}>
                  {busy === r.contractJobId && <Loader2 className="h-4 w-4 animate-spin" />}
                  สร้างใบงานรอบที่ {r.nextRoundNumber} + แจ้งลูกค้า
                </Button>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** ลูกค้า: กำหนดบำรุงรักษาครั้งถัดไปของสัญญาตัวเอง */
export function CustomerServiceReminder() {
  const { data, loading } = useApi<ServiceRound[]>("/api/service-rounds");
  if (loading || !data || data.length === 0) return null;
  return (
    <Card className="border-primary/40">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" /> กำหนดบำรุงรักษาลิฟต์ของคุณ
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {data.map((r) => (
          <p key={r.contractJobId}>
            {r.jobAddress}:{" "}
            {r.nextServiceDate ? (
              <>
                รอบถัดไป <span className="font-medium">{thDate(r.nextServiceDate)}</span> ({dueLabel(r)})
              </>
            ) : (
              "สัญญาบำรุงสิ้นสุดแล้ว"
            )}
            <span className="text-muted-foreground"> · สัญญาถึง {thDate(r.endServiceDate)}</span>
          </p>
        ))}
      </CardContent>
    </Card>
  );
}

type ScheduleItem = {
  planId: string;
  startDate: string;
  endDate: string;
  location: string;
  isToday: boolean;
  isOverdue: boolean;
  job: { jobType: string; status: string; customer: { customerName: string } };
};

/** ช่าง: งานวันนี้และงานถัดไป */
export function TechnicianTodayPanel() {
  const { data, loading } = useApi<{ items: ScheduleItem[] }>("/api/technicians/schedule?mine=1");
  const items = data?.items ?? [];
  const urgent = items.filter((i) => i.isToday || i.isOverdue);
  const upcoming = items.filter((i) => !i.isToday && !i.isOverdue).slice(0, 3);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" /> งานของฉัน
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : items.length === 0 ? (
          <p className="text-muted-foreground">ยังไม่มีงานที่ได้รับมอบหมาย</p>
        ) : (
          <>
            {urgent.map((i) => (
              <p key={i.planId} className={i.isOverdue ? "text-destructive" : "font-medium"}>
                {i.isOverdue ? "เลยกำหนด" : "วันนี้"}: {JOB_TYPE_LABEL[i.job.jobType]} — {i.job.customer.customerName} ({i.location})
              </p>
            ))}
            {upcoming.map((i) => (
              <p key={i.planId} className="text-muted-foreground">
                {thDateRange(i.startDate, i.endDate)}: {JOB_TYPE_LABEL[i.job.jobType]} — {i.job.customer.customerName}
              </p>
            ))}
            <Link href="/technician/schedule" className="text-xs text-primary hover:underline">
              ดูตารางงานทั้งหมด →
            </Link>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** บัญชี: ใบแจ้งหนี้ร่างรอตรวจสอบ + วัสดุที่ต้องสั่งซื้อ */
export function AccountantAlerts() {
  const invoices = useApi<{ status: string; totalAmount: string | number; payments: { amount: string | number }[] }[]>("/api/invoices");
  const shortages = useApi<StockData>("/api/materials/shortages");
  const drafts = (invoices.data ?? []).filter((r) => r.status === "DRAFT").length;
  const unpaid = (invoices.data ?? []).filter((r) => r.status === "UNPAID");
  const unpaidAmount = unpaid.reduce(
    (s, r) => s + Math.max(0, Number(r.totalAmount) - r.payments.reduce((a, p) => a + Number(p.amount), 0)),
    0
  );
  const short = shortages.data?.shortages.length ?? 0;
  const low = shortages.data?.lowStock.length ?? 0;
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Link href="/accountant/invoices">
        <Card className={`hover:shadow-md transition-shadow ${drafts ? "border-amber-400" : ""}`}>
          <CardContent className="pt-6 flex items-center gap-3">
            <Receipt className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">ใบแจ้งหนี้รอตรวจสอบ: {invoices.loading ? "…" : drafts}</p>
              <p className="text-xs text-muted-foreground">ระบบออกให้อัตโนมัติเมื่อลูกค้าตรวจรับงาน</p>
            </div>
          </CardContent>
        </Card>
      </Link>
      <Link href="/accountant/purchase">
        <Card className={`hover:shadow-md transition-shadow ${short ? "border-amber-400" : ""}`}>
          <CardContent className="pt-6 flex items-center gap-3">
            {short ? <PackageX className="h-6 w-6 text-amber-600" /> : <AlertTriangle className="h-6 w-6 text-muted-foreground" />}
            <div>
              <p className="font-medium">วัสดุที่ต้องสั่งซื้อ: {shortages.loading ? "…" : short} รายการ</p>
              <p className="text-xs text-muted-foreground">
                จองในแผนงานมากกว่าของในคลัง
                {low > 0 && (
                  <>
                    {" · "}
                    <Badge variant="warning" className="ml-0.5">ใกล้หมด {low}</Badge>
                  </>
                )}
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
      <Link href="/accountant/receivables">
        <Card className={`hover:shadow-md transition-shadow ${unpaid.length ? "border-amber-400" : ""}`}>
          <CardContent className="pt-6 flex items-center gap-3">
            <Wallet className="h-6 w-6 text-primary" />
            <div>
              <p className="font-medium">ค้างชำระ: {invoices.loading ? "…" : unpaid.length} ใบ</p>
              <p className="text-xs text-muted-foreground">
                ยอดคงค้าง {unpaidAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })} บาท
              </p>
            </div>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}

type StockRow = { id: string; materialName: string; shortageQty?: number; availableQty?: number };
type StockData = { shortages: StockRow[]; lowStock: StockRow[]; threshold: number };

/** ช่าง/หัวหน้าช่าง: วัสดุไม่พอสำหรับแผนงาน และวัสดุใกล้หมด (เกณฑ์ตั้งได้ด้วย env LOW_STOCK_THRESHOLD) */
export function StockAlertsPanel({ href = "/technician/materials" }: { href?: string }) {
  const { data, loading } = useApi<StockData>("/api/materials/shortages");
  if (loading || !data) return null;
  const { shortages, lowStock, threshold } = data;
  if (shortages.length === 0 && lowStock.length === 0) return null;
  return (
    <Card className={shortages.length ? "border-destructive/60" : "border-amber-400"}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <PackageSearch className="h-5 w-5 text-primary" /> แจ้งเตือนสต็อกวัสดุ
          {shortages.length > 0 && <Badge variant="destructive">ไม่พอ {shortages.length}</Badge>}
          {lowStock.length > 0 && <Badge variant="warning">ใกล้หมด {lowStock.length}</Badge>}
        </CardTitle>
        <CardDescription>ใกล้หมด = คงเหลือหลังหักยอดจองไม่เกิน {threshold} ชิ้น</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 text-sm">
        {shortages.slice(0, 5).map((m) => (
          <p key={m.id} className="text-destructive">
            {m.materialName} — ขาด {m.shortageQty} ชิ้น
          </p>
        ))}
        {lowStock.slice(0, 5).map((m) => (
          <p key={m.id} className="text-amber-700">
            {m.materialName} — เหลือใช้ได้ {m.availableQty} ชิ้น
          </p>
        ))}
        <Link href={href} className="text-xs text-primary hover:underline">
          ดูสต็อกทั้งหมด →
        </Link>
      </CardContent>
    </Card>
  );
}
