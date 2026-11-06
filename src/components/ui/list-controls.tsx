// src/components/ui/list-controls.tsx
// แถบค้นหา/กรอง + แบ่งหน้า ใช้ร่วมกันทุกหน้ารายการ
"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export type ListFilters = { q: string; status: string; jobType: string; from: string; to: string };
export const EMPTY_FILTERS: ListFilters = { q: "", status: "", jobType: "", from: "", to: "" };

/** แปลงตัวกรองเป็น query string (ข้ามค่าว่าง) */
export function filtersToQuery(f: Partial<ListFilters>, extra: Record<string, string> = {}): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** หน่วงค่าก่อนส่งค้นหา (พิมพ์แล้วรอ 300ms) */
export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Option = { value: string; label: string };

export function FilterBar({
  value,
  onChange,
  searchPlaceholder = "ค้นหา…",
  statusOptions,
  jobTypeOptions,
  showDates = true,
  dateLabel = "วันที่",
}: {
  value: ListFilters;
  onChange: (next: ListFilters) => void;
  searchPlaceholder?: string;
  statusOptions?: Option[];
  jobTypeOptions?: Option[];
  showDates?: boolean;
  dateLabel?: string;
}) {
  const set = (patch: Partial<ListFilters>) => onChange({ ...value, ...patch });
  const active = Object.values(value).some(Boolean);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3 print:hidden">
      <div className="space-y-1 grow min-w-[200px]">
        <Label htmlFor="flt-q" className="text-xs">ค้นหา</Label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="flt-q"
            className="pl-8"
            placeholder={searchPlaceholder}
            value={value.q}
            onChange={(e) => set({ q: e.target.value })}
          />
        </div>
      </div>
      {statusOptions && (
        <div className="space-y-1 w-44">
          <Label htmlFor="flt-status" className="text-xs">สถานะ</Label>
          <select id="flt-status" className={selectClass} value={value.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="">ทั้งหมด</option>
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      {jobTypeOptions && (
        <div className="space-y-1 w-40">
          <Label htmlFor="flt-type" className="text-xs">ประเภทงาน</Label>
          <select id="flt-type" className={selectClass} value={value.jobType} onChange={(e) => set({ jobType: e.target.value })}>
            <option value="">ทั้งหมด</option>
            {jobTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}
      {showDates && (
        <>
          <div className="space-y-1">
            <Label htmlFor="flt-from" className="text-xs">{dateLabel} ตั้งแต่</Label>
            <Input id="flt-from" type="date" value={value.from} max={value.to || undefined} onChange={(e) => set({ from: e.target.value })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="flt-to" className="text-xs">ถึง</Label>
            <Input id="flt-to" type="date" value={value.to} min={value.from || undefined} onChange={(e) => set({ to: e.target.value })} />
          </div>
        </>
      )}
      {active && (
        <Button type="button" variant="ghost" size="sm" onClick={() => onChange(EMPTY_FILTERS)}>
          <X className="h-4 w-4" /> ล้างตัวกรอง
        </Button>
      )}
    </div>
  );
}

/** แบ่งหน้าฝั่ง client — กลับไปหน้า 1 อัตโนมัติเมื่อรายการเปลี่ยน */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  useEffect(() => setPage(1), [items.length]);
  const current = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => items.slice((current - 1) * pageSize, current * pageSize),
    [items, current, pageSize]
  );
  return { page: current, setPage, totalPages, pageItems, total: items.length, pageSize };
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
}) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);
  return (
    <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground print:hidden">
      <span>
        แสดง {first}–{last} จาก {total} รายการ
      </span>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="หน้าก่อนหน้า">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="px-2">
            หน้า {page} / {totalPages}
          </span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="หน้าถัดไป">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
