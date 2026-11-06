// src/lib/csv.ts
// สร้างไฟล์ CSV ให้เปิดใน Excel ได้ภาษาไทยถูกต้อง (UTF-8 + BOM) และดาวน์โหลดจากเบราว์เซอร์

export type CsvValue = string | number | boolean | null | undefined | Date;

function cell(v: CsvValue): string {
  if (v === null || v === undefined) return "";
  let s = v instanceof Date ? v.toISOString() : String(v);
  // กัน CSV/formula injection เมื่อเปิดใน Excel (ค่าที่ขึ้นต้นด้วย = + - @ ถูกตีความเป็นสูตร)
  if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

export function downloadCsv(filename: string, headers: string[], rows: CsvValue[][]) {
  const blob = new Blob(["﻿" + toCsv(headers, rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** วันที่แบบ YYYY-MM-DD ตามเวลาไทย สำหรับใส่ใน CSV/ชื่อไฟล์ */
export function csvDate(d: string | Date | null | undefined): string {
  if (!d) return "";
  return new Date(new Date(d).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}
