// src/components/stock-history-panel.tsx
// ประวัติสต็อกของวัสดุ 1 รายการ — รับเข้า / เบิกใช้ / ปรับยอด พร้อมตรวจยอดกระทบ (ผลรวมประวัติ = ยอดคงเหลือ)
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, History, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STOCK_REASON_LABEL, thDateTime } from "@/lib/labels";

type Movement = {
  id: string;
  change: number;
  balanceAfter: number;
  reason: string;
  note: string | null;
  createdAt: string;
  employee: { employeeName: string } | null;
  job: { id: string; jobAddress: string; customer: { customerName: string } } | null;
};

type HistoryResponse = {
  material: { id: string; materialName: string; stockQuantity: number };
  movements: Movement[];
  nextCursor: string | null;
  reconciliation: { loggedBalance: number; actualBalance: number; matches: boolean };
};

const REASON_VARIANT: Record<string, "default" | "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  INITIAL: "secondary",
  RESTOCK: "success",
  JOB_USAGE: "warning",
  ADJUSTMENT: "outline",
};

export function StockHistoryPanel({ materialId, onClose }: { materialId: string; onClose: () => void }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      const qs = new URLSearchParams({ limit: "30" });
      if (cursor) qs.set("cursor", cursor);
      const res = await fetch(`/api/materials/${materialId}/movements?${qs}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.message || "โหลดประวัติสต็อกไม่สำเร็จ");
      return json.data as HistoryResponse;
    },
    [materialId]
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    load()
      .then((d) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const loadMore = async () => {
    if (!data?.nextCursor) return;
    setLoadingMore(true);
    try {
      const next = await load(data.nextCursor);
      setData({ ...next, movements: [...data.movements, ...next.movements] });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Card className="border-primary/40 shadow-lg">
      <CardHeader className="flex flex-row items-start justify-between gap-4 pb-3">
        <div className="space-y-1">
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5 text-primary" />
            ประวัติสต็อก{data ? `: ${data.material.materialName}` : ""}
          </CardTitle>
          {data && <CardDescription>ยอดคงเหลือปัจจุบัน {data.material.stockQuantity} ชิ้น</CardDescription>}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="ปิดประวัติสต็อก">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{error}</div>
        ) : data ? (
          <>
            {data.reconciliation.matches ? (
              <div className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle2 className="h-4 w-4" /> ยอดตามประวัติตรงกับยอดคงเหลือในคลัง
              </div>
            ) : (
              <div className="flex items-start gap-2 p-3 rounded-md bg-amber-50 border border-amber-300 text-sm text-amber-800">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  ยอดไม่ตรงกัน: รวมตามประวัติ {data.reconciliation.loggedBalance} ชิ้น แต่ในคลังมี{" "}
                  {data.reconciliation.actualBalance} ชิ้น (ต่างกัน{" "}
                  {data.reconciliation.actualBalance - data.reconciliation.loggedBalance}) — อาจมีการแก้ยอดนอกระบบ
                  หรือยังไม่ได้บันทึกยอดยกมา
                </span>
              </div>
            )}

            {data.movements.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">ยังไม่มีประวัติการเคลื่อนไหว</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">วันเวลา</th>
                      <th className="py-2 pr-3 font-medium">รายการ</th>
                      <th className="py-2 pr-3 font-medium text-right">จำนวน</th>
                      <th className="py-2 pr-3 font-medium text-right">คงเหลือ</th>
                      <th className="py-2 pr-3 font-medium">ผู้ทำรายการ</th>
                      <th className="py-2 font-medium">อ้างอิง / หมายเหตุ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movements.map((m) => (
                      <tr key={m.id} className="border-b last:border-0 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">{thDateTime(m.createdAt)}</td>
                        <td className="py-2 pr-3">
                          <Badge variant={REASON_VARIANT[m.reason] ?? "outline"}>{STOCK_REASON_LABEL[m.reason] ?? m.reason}</Badge>
                        </td>
                        <td className={`py-2 pr-3 text-right font-medium tabular-nums ${m.change < 0 ? "text-destructive" : "text-green-700"}`}>
                          {m.change > 0 ? `+${m.change}` : m.change}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">{m.balanceAfter}</td>
                        <td className="py-2 pr-3">{m.employee?.employeeName ?? "ระบบ"}</td>
                        <td className="py-2 text-xs text-muted-foreground">
                          {m.job && (
                            <div>
                              {m.job.customer.customerName} — {m.job.jobAddress}
                            </div>
                          )}
                          {m.note && <div>{m.note}</div>}
                          {!m.job && !m.note && "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {data.nextCursor && (
              <div className="flex justify-center pt-1">
                <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore}>
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} โหลดเพิ่ม
                </Button>
              </div>
            )}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
