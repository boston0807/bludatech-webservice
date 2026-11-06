// src/components/schedule/schedule-calendar.tsx
// ปฏิทินตารางงานช่างรายเดือน/รายสัปดาห์ — เห็นงานซ้อนของช่างคนเดียวกันในวันเดียวกันได้ทันที
"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { selectClass } from "@/components/ui/list-controls";
import { JOB_TYPE_LABEL, thDateRange } from "@/lib/labels";
import { bangkokDayKey } from "@/lib/dates";

export type CalendarItem = {
  planId: string;
  startDate: string;
  endDate: string;
  location: string;
  isOverdue?: boolean;
  job: { id: string; jobType: string; status: string; customer: { customerName: string } };
  technicians: { id: string; employeeName: string }[];
};

const WEEKDAYS = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const TYPE_COLOR: Record<string, string> = {
  INSTALLATION: "bg-blue-100 text-blue-900 border-blue-300",
  REPAIR: "bg-orange-100 text-orange-900 border-orange-300",
  SERVICE: "bg-emerald-100 text-emerald-900 border-emerald-300",
};

const DAY_MS = 24 * 60 * 60 * 1000;
/** วันที่ (UTC เที่ยงคืน) ที่แทน "วัน" ตามเวลาไทย */
const keyToDate = (key: string) => new Date(`${key}T00:00:00Z`);
const dateToKey = (d: Date) => d.toISOString().slice(0, 10);

export function ScheduleCalendar({ items }: { items: CalendarItem[] }) {
  const todayKey = bangkokDayKey(new Date());
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(todayKey); // วันใดวันหนึ่งในช่วงที่แสดง
  const [tech, setTech] = useState("");

  const technicians = useMemo(() => {
    const m = new Map<string, string>();
    items.forEach((i) => i.technicians.forEach((t) => m.set(t.id, t.employeeName)));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1], "th"));
  }, [items]);

  const filtered = tech ? items.filter((i) => i.technicians.some((t) => t.id === tech)) : items;

  // ช่วงวันที่ต้องแสดง (เริ่มวันอาทิตย์)
  const days = useMemo(() => {
    const a = keyToDate(anchor);
    let start: Date;
    let count: number;
    if (view === "week") {
      start = new Date(a.getTime() - a.getUTCDay() * DAY_MS);
      count = 7;
    } else {
      const first = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), 1));
      const last = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + 1, 0));
      start = new Date(first.getTime() - first.getUTCDay() * DAY_MS);
      const end = new Date(last.getTime() + (6 - last.getUTCDay()) * DAY_MS);
      count = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    }
    return Array.from({ length: count }, (_, i) => dateToKey(new Date(start.getTime() + i * DAY_MS)));
  }, [anchor, view]);

  // งานในแต่ละวัน + ช่างที่ถูกจัดงานซ้อนในวันนั้น
  const byDay = useMemo(() => {
    const map = new Map<string, { list: CalendarItem[]; clash: Set<string> }>();
    for (const day of days) {
      const list = filtered.filter((i) => bangkokDayKey(new Date(i.startDate)) <= day && day <= bangkokDayKey(new Date(i.endDate)));
      const seen = new Map<string, number>();
      list.forEach((i) => i.technicians.forEach((t) => seen.set(t.id, (seen.get(t.id) ?? 0) + 1)));
      map.set(day, { list, clash: new Set([...seen].filter(([, n]) => n > 1).map(([id]) => id)) });
    }
    return map;
  }, [days, filtered]);

  const clashDays = [...byDay.values()].filter((d) => d.clash.size > 0).length;

  const a = keyToDate(anchor);
  const monthKey = `${a.getUTCFullYear()}-${String(a.getUTCMonth() + 1).padStart(2, "0")}`;
  const title =
    view === "month"
      ? a.toLocaleDateString("th-TH", { month: "long", year: "numeric", timeZone: "UTC" })
      : thDateRange(`${days[0]}T00:00:00+07:00`, `${days[days.length - 1]}T00:00:00+07:00`);

  const shift = (dir: -1 | 1) => {
    if (view === "week") setAnchor(dateToKey(new Date(a.getTime() + dir * 7 * DAY_MS)));
    else setAnchor(dateToKey(new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth() + dir, 1))));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => shift(-1)} aria-label="ก่อนหน้า">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setAnchor(todayKey)}>
            วันนี้
          </Button>
          <Button size="sm" variant="outline" onClick={() => shift(1)} aria-label="ถัดไป">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="ml-2 font-semibold">{title}</span>
        </div>
        <div className="flex items-center gap-2">
          {technicians.length > 1 && (
            <select className={`${selectClass} w-44`} value={tech} onChange={(e) => setTech(e.target.value)} aria-label="กรองตามช่าง">
              <option value="">ช่างทุกคน</option>
              {technicians.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          )}
          <Button size="sm" variant={view === "month" ? "default" : "outline"} onClick={() => setView("month")}>
            เดือน
          </Button>
          <Button size="sm" variant={view === "week" ? "default" : "outline"} onClick={() => setView("week")}>
            สัปดาห์
          </Button>
        </div>
      </div>

      {clashDays > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-destructive">
          <AlertTriangle className="h-4 w-4" /> พบ {clashDays} วันที่มีช่างถูกจัดงานซ้อนกัน (แสดงกรอบสีแดง)
        </p>
      )}

      <div className="grid grid-cols-7 border-l border-t rounded-md overflow-hidden bg-white text-xs">
        {WEEKDAYS.map((d) => (
          <div key={d} className="border-r border-b bg-muted/50 px-2 py-1 text-center font-medium text-muted-foreground">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const info = byDay.get(day)!;
          const inMonth = view === "week" || day.startsWith(monthKey);
          const isToday = day === todayKey;
          return (
            <div
              key={day}
              className={`border-r border-b p-1 align-top ${view === "week" ? "min-h-[180px]" : "min-h-[96px]"} ${
                inMonth ? "" : "bg-muted/30 text-muted-foreground"
              } ${info.clash.size ? "ring-2 ring-inset ring-destructive" : ""}`}
            >
              <div className={`mb-1 flex h-5 w-5 items-center justify-center rounded-full ${isToday ? "bg-primary text-primary-foreground font-semibold" : ""}`}>
                {Number(day.slice(8))}
              </div>
              <div className="space-y-1">
                {info.list.slice(0, view === "week" ? 10 : 3).map((i) => (
                  <div
                    key={i.planId}
                    title={`${JOB_TYPE_LABEL[i.job.jobType]} — ${i.job.customer.customerName}\n${i.location}\nช่าง: ${i.technicians.map((t) => t.employeeName).join(", ")}`}
                    className={`truncate rounded border px-1 py-0.5 ${TYPE_COLOR[i.job.jobType] ?? "bg-muted"} ${i.isOverdue ? "border-destructive" : ""}`}
                  >
                    <span className="font-medium">{i.job.customer.customerName}</span>
                    {view === "week" && (
                      <span className="block truncate">
                        {i.technicians.map((t) => (
                          <span key={t.id} className={info.clash.has(t.id) ? "text-destructive font-semibold" : ""}>
                            {t.employeeName}{" "}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                ))}
                {info.list.length > (view === "week" ? 10 : 3) && (
                  <p className="text-muted-foreground">+{info.list.length - (view === "week" ? 10 : 3)} งาน</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {Object.entries(TYPE_COLOR).map(([k, cls]) => (
          <span key={k} className="flex items-center gap-1">
            <span className={`inline-block h-3 w-3 rounded border ${cls}`} /> {JOB_TYPE_LABEL[k]}
          </span>
        ))}
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded ring-2 ring-destructive" /> ช่างมีงานซ้อน
        </span>
      </div>
    </div>
  );
}
