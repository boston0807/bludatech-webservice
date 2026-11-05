// src/lib/dates.ts
// วันที่ในระบบเก็บเป็น UTC แต่ธุรกิจทำงานตามเวลาไทย (UTC+7) จึงเทียบ "วัน" ด้วยเวลาไทยเสมอ

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/** คืนค่า YYYY-MM-DD ตามเวลาไทย ใช้เทียบว่าสองช่วงเวลาอยู่วันเดียวกันหรือทับกันไหม */
export function bangkokDayKey(date: Date): string {
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString().slice(0, 10);
}

/** ช่วงวัน [aStart, aEnd] กับ [bStart, bEnd] ทับกันอย่างน้อย 1 วันหรือไม่ (นับแบบรวมวันแรกและวันสุดท้าย) */
export function dayRangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return bangkokDayKey(aStart) <= bangkokDayKey(bEnd) && bangkokDayKey(bStart) <= bangkokDayKey(aEnd);
}

/** บวกเดือนแบบไม่ล้นไปเดือนถัดไป เช่น 31 ม.ค. + 1 เดือน = 28/29 ก.พ. */
export function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

/** จำนวนวันจากวันนี้ (เวลาไทย) ถึงวันที่กำหนด ติดลบ = เลยกำหนดมาแล้ว */
export function daysUntil(date: Date, now: Date = new Date()): number {
  const a = Date.parse(bangkokDayKey(now));
  const b = Date.parse(bangkokDayKey(date));
  return Math.round((b - a) / (24 * 60 * 60 * 1000));
}

export function formatThaiDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Bangkok",
  });
}
