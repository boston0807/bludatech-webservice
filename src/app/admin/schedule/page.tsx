// src/app/admin/schedule/page.tsx
// ธุรการดูตารางงานช่างทั้งทีมแบบปฏิทิน (ตรวจคิวช่างก่อน/หลังลูกค้าอนุมัติแผน)
"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScheduleCalendar, type CalendarItem } from "@/components/schedule/schedule-calendar";

export default function AdminSchedulePage() {
  const [items, setItems] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/technicians/schedule?past=1")
      .then((r) => r.json())
      .then((d) => (d.success ? setItems(d.data.items) : setError(d.message ?? "โหลดตารางงานไม่สำเร็จ")))
      .catch(() => setError("โหลดตารางงานไม่สำเร็จ"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตารางงานช่าง</h1>
        <p className="text-muted-foreground">แผนงานที่ยังไม่ปิดของทุกทีม เรียงตามวันเข้าปฏิบัติงาน · วันที่ช่างคนเดียวกันมีงานซ้อนจะมีกรอบสีแดง</p>
      </div>
      {error && <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{error}</div>}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <ScheduleCalendar items={items} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
