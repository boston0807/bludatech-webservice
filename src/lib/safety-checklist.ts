// src/lib/safety-checklist.ts
// รายการตรวจสอบความปลอดภัยมาตรฐาน (UC13) — ช่างต้องตรวจครบทุกข้อ และผ่านทุกข้อจึงจะส่งให้ลูกค้าตรวจรับได้

export const SAFETY_CHECKLIST = [
  { key: "brake", label: "ระบบเบรกและเบรกฉุกเฉิน (Brake / Safety Gear)" },
  { key: "governor", label: "ระบบควบคุมความเร็วเกิน (Overspeed Governor)" },
  { key: "door_sensor", label: "เซนเซอร์ประตูและระบบกันหนีบ (Light Curtain / Safety Edge)" },
  { key: "door_lock", label: "ระบบล็อกประตูชั้น (Landing Door Interlock)" },
  { key: "emergency", label: "ไฟฉุกเฉิน ระบบสื่อสาร และกริ่งเตือนภัย" },
  { key: "overload", label: "ระบบป้องกันน้ำหนักเกิน (Overload Device)" },
  { key: "leveling", label: "ความแม่นยำการจอดตรงระดับชั้น (Leveling)" },
  { key: "wire_rope", label: "สภาพสลิง รอก และจุดยึด" },
  { key: "electrical", label: "ระบบไฟฟ้า สายดิน และตู้ควบคุม" },
] as const;

export type SafetyItemKey = (typeof SAFETY_CHECKLIST)[number]["key"];

export type SafetyCheckItem = {
  key: SafetyItemKey;
  label: string;
  passed: boolean;
  remark: string | null;
};

type ItemInput = { key?: unknown; passed?: unknown; remark?: unknown };

/**
 * ตรวจว่าส่งผลมาครบทุกข้อในรายการมาตรฐาน แล้วคืนรายการที่จัดรูปแบบแล้ว
 * ข้อที่ไม่ผ่านต้องระบุหมายเหตุเสมอ เพื่อให้ช่างรู้ว่าต้องแก้อะไร
 */
export function parseSafetyItems(
  input: unknown
): { ok: true; items: SafetyCheckItem[]; passed: boolean } | { ok: false; message: string } {
  if (!Array.isArray(input)) {
    return { ok: false, message: "กรุณาส่งผลการตรวจตามรายการตรวจสอบความปลอดภัย (items)" };
  }
  const byKey = new Map<string, ItemInput>();
  for (const raw of input as ItemInput[]) {
    if (raw && typeof raw.key === "string") byKey.set(raw.key, raw);
  }

  const items: SafetyCheckItem[] = [];
  for (const def of SAFETY_CHECKLIST) {
    const raw = byKey.get(def.key);
    if (!raw || typeof raw.passed !== "boolean") {
      return { ok: false, message: `กรุณาบันทึกผลการตรวจข้อ "${def.label}"` };
    }
    const remark = typeof raw.remark === "string" && raw.remark.trim() ? raw.remark.trim().slice(0, 500) : null;
    if (!raw.passed && !remark) {
      return { ok: false, message: `กรุณาระบุสิ่งที่พบในข้อที่ไม่ผ่าน: "${def.label}"` };
    }
    items.push({ key: def.key, label: def.label, passed: raw.passed, remark });
  }

  return { ok: true, items, passed: items.every((i) => i.passed) };
}

/**
 * UC13 ข้อ 5: บันทึกผลการตรวจ (PASS) ต่อท้าย job_note — ไม่มีตารางแยก เก็บเป็นข้อความในใบงาน
 */
export function appendSafetyResultToNote(
  jobNote: string | null,
  params: { items: SafetyCheckItem[]; note: string | null; technicianName: string; checkedAt: Date }
): string {
  const { items, note, technicianName, checkedAt } = params;
  const date = checkedAt.toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
  const lines = [
    `[ผลทดสอบความปลอดภัย: PASS] ${date} โดย ${technicianName}`,
    ...items.map((i) => `- ${i.label}: ผ่าน${i.remark ? ` (${i.remark})` : ""}`),
    ...(note ? [`หมายเหตุช่าง: ${note}`] : []),
  ];
  return [jobNote?.trim(), lines.join("\n")].filter(Boolean).join("\n\n");
}

const SAFETY_RESULT_MARK = "[ผลทดสอบความปลอดภัย:";

/** ดึงผลทดสอบความปลอดภัยครั้งล่าสุดที่บันทึกไว้ใน job_note (null ถ้ายังไม่เคยทดสอบผ่าน) */
export function latestSafetyResult(jobNote: string | null | undefined): string | null {
  if (!jobNote) return null;
  const i = jobNote.lastIndexOf(SAFETY_RESULT_MARK);
  return i === -1 ? null : jobNote.slice(i).trim();
}

/** job_note ส่วนที่ลูกค้ากรอกตอนยื่นคำขอ (ตัดผลทดสอบความปลอดภัยที่ระบบต่อท้ายออก) */
export function jobNoteWithoutSafety(jobNote: string | null | undefined): string | null {
  if (!jobNote) return null;
  const i = jobNote.indexOf(SAFETY_RESULT_MARK);
  const rest = (i === -1 ? jobNote : jobNote.slice(0, i)).trim();
  return rest || null;
}
