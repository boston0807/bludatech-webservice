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
