// src/lib/list-filters.ts
// อ่าน query param สำหรับค้นหา/กรองรายการ (ใช้ร่วมกันหลาย API)

import type { JobType } from "@prisma/client";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const JOB_TYPES: JobType[] = ["INSTALLATION", "REPAIR", "SERVICE"];

/** ช่วงวันที่ตามเวลาไทย: 00:00 ของ from ถึง 23:59:59.999 ของ to (รวมวันสุดท้าย) */
export function parseDateRange(searchParams: URLSearchParams): { from: Date; to: Date } | null {
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  if (!fromStr || !toStr || !DATE_RE.test(fromStr) || !DATE_RE.test(toStr)) return null;
  const from = new Date(`${fromStr}T00:00:00.000+07:00`);
  const to = new Date(`${toStr}T23:59:59.999+07:00`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return null;
  return { from, to };
}

/** ช่วงวันที่แบบไม่บังคับ — ระบุแค่ from หรือแค่ to ก็ได้ คืน Prisma DateTimeFilter หรือ undefined */
export function optionalDateFilter(searchParams: URLSearchParams): { gte?: Date; lte?: Date } | undefined {
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const filter: { gte?: Date; lte?: Date } = {};
  const parse = (s: string | null, time: string) => {
    if (!s || !DATE_RE.test(s)) return undefined;
    const d = new Date(`${s}${time}`);
    return Number.isNaN(d.getTime()) ? undefined : d;
  };
  filter.gte = parse(fromStr, "T00:00:00.000+07:00");
  filter.lte = parse(toStr, "T23:59:59.999+07:00");
  if (!filter.gte) delete filter.gte;
  if (!filter.lte) delete filter.lte;
  return filter.gte || filter.lte ? filter : undefined;
}

/** คำค้นหา (ตัดช่องว่าง จำกัดความยาว) หรือ undefined */
export function searchTerm(searchParams: URLSearchParams): string | undefined {
  const q = searchParams.get("q")?.trim();
  return q ? q.slice(0, 100) : undefined;
}

export function jobTypeParam(searchParams: URLSearchParams): JobType | undefined {
  const t = searchParams.get("jobType");
  return t && (JOB_TYPES as string[]).includes(t) ? (t as JobType) : undefined;
}
